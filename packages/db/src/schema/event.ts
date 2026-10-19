import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { courses, lessons } from "./course";
import { user } from "./profile";

/** Learner activity and course lifecycle events recorded against a course. */
export type CourseEventType =
  | "view"
  | "progress"
  | "complete"
  | "drop"
  | "publish"
  | "version_bump"
  | "archive"
  | "unarchive";

export const courseEvent = pgTable(
  "course_event",
  {
    id: text("id").primaryKey(),
    // ADR-0002: every table holding institution data carries tenant_id from migration one.
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // Nullable: a "drop" event can fire at course level, with no lesson in focus.
    lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    type: text("type").$type<CourseEventType>().notNull(),
    positionSeconds: integer("position_seconds").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("course_event_tenant_id_idx").on(table.tenantId),
    index("course_event_user_id_idx").on(table.userId),
    index("course_event_course_id_idx").on(table.courseId),
    index("course_event_lesson_id_idx").on(table.lessonId),
    index("course_event_course_id_created_at_idx").on(table.courseId, table.createdAt),
  ],
);

export const courseEvents = courseEvent;

export type CourseEvent = typeof courseEvent.$inferSelect;
export type NewCourseEvent = typeof courseEvent.$inferInsert;
