import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Minimal mirror of Better Auth's `user` table, used as the foreign-key target
 * for profile rows. Better Auth owns the full table definition at runtime.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
});

export const users = user;

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