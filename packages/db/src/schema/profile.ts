import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user, users } from "./auth";

export { user, users };

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  bio: text("bio"),
  websiteUrl: text("website_url"),
  socialLinksJson: text("social_links_json"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const profile = profiles;
export const userProfiles = profiles;
export const userProfile = profiles;

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;