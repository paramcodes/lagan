import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./profile";

/**
 * Lifecycle of a course as seen by authors and learners.
 *
 * Typed as a union rather than a Postgres enum so the value set can grow without
 * a migration that rewrites the type; `erasableSyntaxOnly` also forbids TS enums.
 */
export type CourseStatus = "draft" | "published" | "archived";

/** Lifecycle of a single lesson. Lessons publish individually, then with the course. */
export type LessonStatus = "draft" | "published";

/** Kind of media a lesson carries. Drives which player route renders it. */
export type LessonType = "video" | "text" | "quiz" | "file" | "external";

/** TiPTap document stored for text and quiz lessons. */
export type LessonContent = {
  type: "doc";
  content?: unknown[];
};

export const courses = pgTable(
  "courses",
  {
    id: text("id").primaryKey(),
    // Tenants table lands with the tenancy ADR (ADR-0014); the column is here from
    // migration one per ADR-0002 so no backfill is needed later.
    tenantId: text("tenant_id").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    discountPercent: integer("discount_percent").notNull().default(0),
    isFree: boolean("is_free").notNull().default(false),
    status: text("status").$type<CourseStatus>().notNull().default("draft"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("courses_tenant_id_idx").on(table.tenantId),
    index("courses_author_id_idx").on(table.authorId),
    index("courses_status_idx").on(table.status),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    index("modules_course_id_idx").on(table.courseId),
    uniqueIndex("modules_course_id_position_key").on(table.courseId, table.position),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    type: text("type").$type<LessonType>().notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    status: text("status").$type<LessonStatus>().notNull().default("draft"),
    muxPlaybackId: text("mux_playback_id"),
    contentJson: jsonb("content_json").$type<LessonContent>(),
    externalUrl: text("external_url"),
    fileKey: text("file_key"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lessons_module_id_idx").on(table.moduleId),
    uniqueIndex("lessons_module_id_position_key").on(table.moduleId, table.position),
  ],
);

// Singular aliases, matching the `profile`/`profiles` convention in profile.ts.
export const course = courses;
export const module = modules;
export const lesson = lessons;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
