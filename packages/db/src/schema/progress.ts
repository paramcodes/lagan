import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { courses, lessons } from "./course";
import { user } from "./profile";

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lesson_progress_user_id_lesson_id_key").on(table.userId, table.lessonId),
    index("lesson_progress_user_id_course_id_completed_idx").on(
      table.userId,
      table.courseId,
      table.completed,
    ),
    index("lesson_progress_tenant_id_idx").on(table.tenantId),
  ],
);

export const lesson_progress = lessonProgress;
export const lessonProgresses = lessonProgress;

export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;
