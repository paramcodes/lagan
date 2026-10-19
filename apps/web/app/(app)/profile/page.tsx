import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { profiles } from "@lagan/db";
import { eq } from "drizzle-orm";
import type { ProfileFormValues } from "./schema";
import ProfileForm from "./profile-form";

export const instant = false;


function parseSocialLinks(json: string | null): ProfileFormValues["socialLinks"] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export default async function ProfilePage() {
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const userId = session.user.id;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const initial: ProfileFormValues = {
    bio: profile?.bio ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    avatarUrl: profile?.avatarUrl ?? "",
    socialLinks: parseSocialLinks(profile?.socialLinksJson ?? null),
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Profile</h1>
      <ProfileForm initial={initial} />
    </main>
  );
}
