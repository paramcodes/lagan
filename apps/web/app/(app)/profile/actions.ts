"use server";

import { headers } from "next/headers";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { profiles } from "@lagan/db";
import { RateLimitError, checkRateLimit } from "../../../lib/rate-limit";
import { profileSchema, type ProfileFormValues } from "./schema";
export async function updateProfile(input: ProfileFormValues) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;
  const rl = checkRateLimit(`profile:${userId}`, 30, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const data = profileSchema.parse(input);

  const values = {
    bio: data.bio === "" ? null : data.bio,
    websiteUrl: data.websiteUrl === "" ? null : data.websiteUrl,
    avatarUrl: data.avatarUrl === "" ? null : data.avatarUrl,
    socialLinksJson:
      data.socialLinks && data.socialLinks.length > 0 ? JSON.stringify(data.socialLinks) : null,
    updatedAt: new Date(),
  };

  await db
    .insert(profiles)
    .values({ id: crypto.randomUUID(), userId, ...values })
    .onConflictDoUpdate({ target: profiles.userId, set: values });
}
