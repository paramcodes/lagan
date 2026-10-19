import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { courses } from "./course";
import { user } from "./profile";

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    stripePaymentId: text("stripe_payment_id").notNull().unique(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
    courseVersionSeen: integer("course_version_seen").notNull().default(1),
  },
  (table) => [
    index("enrollments_user_id_idx").on(table.userId),
    index("enrollments_course_id_idx").on(table.courseId),
    uniqueIndex("enrollments_user_id_course_id_key").on(table.userId, table.courseId),
  ],
);

export const enrollment = enrollments;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
