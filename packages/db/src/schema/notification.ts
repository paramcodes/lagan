import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./profile";

export type NotificationType =
  | "course_published"
  | "lesson_published"
  | "enrollment_confirmed"
  | "announcement_posted"
  | (string & {});

export type NotificationPayload = Record<string, unknown>;

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<NotificationPayload>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_read_at_created_at_idx").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
    index("notifications_tenant_id_idx").on(table.tenantId),
  ],
);

export const notification = notifications;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
