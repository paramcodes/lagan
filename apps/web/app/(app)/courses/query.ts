import { courses, user } from "@lagan/db";
import type { CourseCardData } from "@lagan/ui";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../lib/db";
import { buildPublishedCourseWhere } from "./filters";
import { COURSE_PAGE_SIZE, clampPage, coursePageCount, pageOffset } from "./params";
import type { CourseListParams } from "./params";

export interface CourseListResult {
  rows: CourseCardData[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Better Auth owns the `user` table and its `name` column; the local drizzle
 * mirror only declares `id`, so the display name is reached with a raw column
 * reference. It is static SQL — no caller input reaches it.
 */
const authorName = sql<string>`coalesce(${user}."name", 'Unknown author')`;

export async function listPublishedCourses(params: CourseListParams): Promise<CourseListResult> {
  const where = buildPublishedCourseWhere(params.search);

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(courses)
    .where(where);
  const total = totals?.total ?? 0;

  const pageCount = coursePageCount(total);
  const page = clampPage(params.page, pageCount);

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      priceCents: courses.priceCents,
      discountPercent: courses.discountPercent,
      isFree: courses.isFree,
      status: courses.status,
      authorName,
    })
    .from(courses)
    .leftJoin(user, eq(user.id, courses.authorId))
    .where(where)
    .orderBy(desc(courses.publishedAt), asc(courses.id))
    .limit(COURSE_PAGE_SIZE)
    .offset(pageOffset(page));

  return { rows, total, page, pageCount };
}
