import { courses, enrollments, profiles, user } from "@lagan/db";
import type { CourseCardData } from "@lagan/ui";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "../../../../lib/db";

export interface SocialLink {
  label: string;
  url: string;
}

export interface AuthorProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string;
  websiteUrl: string | null;
  socialLinks: SocialLink[];
}

export interface AuthorStats {
  publishedCoursesCount: number;
  enrolledLearnersCount: number;
}

export function parseSocialLinks(json: string | null): SocialLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SocialLink =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.label === "string" &&
        item.label.trim().length > 0 &&
        typeof item.url === "string" &&
        item.url.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export async function getAuthorProfile(
  authorId: string,
  database = db,
): Promise<AuthorProfile | null> {
  const [row] = await database
    .select({
      id: user.id,
      name: sql<string>`coalesce(${user}."name", 'Unknown author')`,
      userImage: sql<string | null>`${user}."image"`,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      websiteUrl: profiles.websiteUrl,
      socialLinksJson: profiles.socialLinksJson,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(or(eq(user.id, authorId), eq(profiles.id, authorId)))
    .limit(1);

  if (!row) {
    // Check if profile exists directly without user entry (e.g. decoupled test fixture)
    const [profileRow] = await database
      .select({
        id: profiles.id,
        userId: profiles.userId,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        websiteUrl: profiles.websiteUrl,
        socialLinksJson: profiles.socialLinksJson,
      })
      .from(profiles)
      .where(or(eq(profiles.userId, authorId), eq(profiles.id, authorId)))
      .limit(1);

    if (!profileRow) {
      return null;
    }

    return {
      id: profileRow.userId,
      name: "Instructor",
      avatarUrl: profileRow.avatarUrl,
      bio: profileRow.bio,
      headline: "Instructor",
      websiteUrl: profileRow.websiteUrl,
      socialLinks: parseSocialLinks(profileRow.socialLinksJson),
    };
  }

  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarUrl || row.userImage || null,
    bio: row.bio,
    headline: "Instructor",
    websiteUrl: row.websiteUrl,
    socialLinks: parseSocialLinks(row.socialLinksJson),
  };
}

export async function getAuthorStats(authorId: string, database = db): Promise<AuthorStats> {
  const [coursesRes] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(courses)
    .where(and(eq(courses.authorId, authorId), eq(courses.status, "published")));

  const [learnersRes] = await database
    .select({
      count: sql<number>`coalesce(count(distinct ${enrollments.userId}), 0)::int`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(courses.authorId, authorId), eq(courses.status, "published")));

  return {
    publishedCoursesCount: Number(coursesRes?.count ?? 0),
    enrolledLearnersCount: Number(learnersRes?.count ?? 0),
  };
}

export async function getAuthorPublishedCourses(
  authorId: string,
  database = db,
): Promise<CourseCardData[]> {
  const authorNameSql = sql<string>`coalesce(${user}."name", 'Unknown author')`;

  return await database
    .select({
      id: courses.id,
      title: courses.title,
      priceCents: courses.priceCents,
      discountPercent: courses.discountPercent,
      isFree: courses.isFree,
      status: courses.status,
      authorName: authorNameSql,
    })
    .from(courses)
    .leftJoin(user, eq(user.id, courses.authorId))
    .where(and(eq(courses.authorId, authorId), eq(courses.status, "published")))
    .orderBy(desc(courses.publishedAt), asc(courses.title));
}
