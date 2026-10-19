import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { courses, lessons, modules } from "./schema/course";
import { enrollments } from "./schema/enrollment";
import { lessonProgress } from "./schema/progress";

export type ProgressDb = Pick<NodePgDatabase<Record<string, never>>, "select">;

let defaultProgressDb: ProgressDb | null = null;

export function setDefaultProgressDb(db: ProgressDb | null): void {
  defaultProgressDb = db;
}

export interface CalculateProgressPercentOptions {
  round?: boolean | undefined;
  precision?: number | undefined;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

export interface CourseProgressSummary extends CourseProgress {
  formatted: string;
  isCompleted: boolean;
}

export interface CourseProgressOptions {
  userId: string;
  courseId: string;
  tenantId: string;
  round?: boolean | number | undefined;
}

export interface UserCoursesProgressOptions {
  userId: string;
  tenantId: string;
  courseIds?: string[] | undefined;
  round?: boolean | number | undefined;
}

/**
 * Calculates percentage of completed lessons against total published lessons safely.
 * Returns 0 on zero or invalid lessons to prevent division by zero or NaN.
 */
export function calculateProgressPercent(
  completedLessons: number,
  totalLessons: number,
  options?: CalculateProgressPercentOptions | boolean | number,
): number {
  if (totalLessons <= 0 || !Number.isFinite(totalLessons)) return 0;
  if (completedLessons <= 0 || !Number.isFinite(completedLessons)) return 0;

  const raw = (completedLessons / totalLessons) * 100;
  const clamped = Math.min(100, Math.max(0, raw));

  if (options === true || (typeof options === "object" && options?.round === true)) {
    return Math.round(clamped);
  }

  const precision =
    typeof options === "number"
      ? options
      : typeof options === "object" && typeof options?.precision === "number"
        ? options.precision
        : undefined;

  if (typeof precision === "number" && precision >= 0) {
    const factor = 10 ** precision;
    return Math.round(clamped * factor) / factor;
  }

  return clamped;
}

export const calculateCourseProgressPercent = calculateProgressPercent;

/**
 * Returns a summary with safe counts, percent, formatted string (e.g. "6 of 10 lessons"),
 * and completion status for UI display in My Learning and course pages.
 */
export function getCourseProgressSummary(
  completedLessons: number,
  totalLessons: number,
  options?: {
    courseId?: string;
    round?: boolean | number;
  },
): CourseProgressSummary {
  const safeTotal = Math.max(0, Number.isFinite(totalLessons) ? Math.floor(totalLessons) : 0);
  const safeCompleted = Math.max(
    0,
    Number.isFinite(completedLessons) ? Math.floor(completedLessons) : 0,
  );
  const percent = calculateProgressPercent(safeCompleted, safeTotal, options?.round);
  const lessonNoun = safeTotal === 1 ? "lesson" : "lessons";
  const formatted = `${safeCompleted} of ${safeTotal} ${lessonNoun}`;
  const isCompleted = safeTotal > 0 && safeCompleted >= safeTotal;

  return {
    courseId: options?.courseId ?? "",
    totalLessons: safeTotal,
    completedLessons: safeCompleted,
    percent,
    formatted,
    isCompleted,
  };
}

/**
 * Single-course progress aggregation helper.
 * Strictly scopes queries by tenantId and userId.
 * Returns null if the course is not found in the given tenant.
 */
export async function getCourseProgress(
  options: CourseProgressOptions,
): Promise<CourseProgress | null>;
export async function getCourseProgress(
  db: ProgressDb,
  options: CourseProgressOptions,
): Promise<CourseProgress | null>;
export async function getCourseProgress(
  db: ProgressDb,
  userId: string,
  courseId: string,
  tenantId: string,
  round?: boolean | number,
): Promise<CourseProgress | null>;
export async function getCourseProgress(
  first: ProgressDb | CourseProgressOptions,
  second?: CourseProgressOptions | string,
  third?: string,
  fourth?: string,
  fifth?: boolean | number,
): Promise<CourseProgress | null> {
  let db: ProgressDb;
  let options: CourseProgressOptions;

  if (typeof (first as ProgressDb)?.select === "function") {
    db = first as ProgressDb;
    if (typeof second === "string") {
      options = {
        userId: second,
        courseId: third ?? "",
        tenantId: fourth ?? "",
        ...(fifth !== undefined ? { round: fifth } : {}),
      };
    } else {
      options = second as CourseProgressOptions;
    }
  } else {
    if (!defaultProgressDb) {
      throw new Error(
        "getCourseProgress requires a db instance as the first argument, or call setDefaultProgressDb(db).",
      );
    }
    db = defaultProgressDb;
    options = first as CourseProgressOptions;
  }

  if (!options?.courseId || !options?.userId || !options?.tenantId) {
    return null;
  }

  // Verify course belongs to tenant
  const [courseRow] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, options.courseId), eq(courses.tenantId, options.tenantId)));

  if (!courseRow) {
    return null;
  }

  // Total published lessons for this course
  const totalRows = await db
    .select({
      total: sql<number>`coalesce(count(${lessons.id}), 0)::int`,
    })
    .from(modules)
    .innerJoin(lessons, and(eq(lessons.moduleId, modules.id), eq(lessons.status, "published")))
    .where(eq(modules.courseId, options.courseId));

  const totalLessons = Number(totalRows[0]?.total ?? 0);

  // Completed published lessons for this user, course, and tenant
  const completedRows = await db
    .select({
      completed: sql<number>`coalesce(count(${lessonProgress.id}), 0)::int`,
    })
    .from(lessonProgress)
    .innerJoin(
      lessons,
      and(eq(lessons.id, lessonProgress.lessonId), eq(lessons.status, "published")),
    )
    .where(
      and(
        eq(lessonProgress.userId, options.userId),
        eq(lessonProgress.courseId, options.courseId),
        eq(lessonProgress.tenantId, options.tenantId),
        eq(lessonProgress.completed, true),
      ),
    );

  const completedLessons = Number(completedRows[0]?.completed ?? 0);
  const percent = calculateProgressPercent(completedLessons, totalLessons, options.round);

  return {
    courseId: options.courseId,
    totalLessons,
    completedLessons,
    percent,
  };
}

/**
 * Batch progress query helper for multiple courses.
 * If options.courseIds is omitted, queries all courses the user is enrolled in
 * or has recorded progress for within the given tenant.
 */
export async function getUserCoursesProgress(
  options: UserCoursesProgressOptions,
): Promise<CourseProgress[]>;
export async function getUserCoursesProgress(
  db: ProgressDb,
  options: UserCoursesProgressOptions,
): Promise<CourseProgress[]>;
export async function getUserCoursesProgress(
  db: ProgressDb,
  userId: string,
  tenantId: string,
  courseIds?: string[],
  round?: boolean | number,
): Promise<CourseProgress[]>;
export async function getUserCoursesProgress(
  first: ProgressDb | UserCoursesProgressOptions,
  second?: UserCoursesProgressOptions | string,
  third?: string,
  fourth?: string[],
  fifth?: boolean | number,
): Promise<CourseProgress[]> {
  let db: ProgressDb;
  let options: UserCoursesProgressOptions;

  if (typeof (first as ProgressDb)?.select === "function") {
    db = first as ProgressDb;
    if (typeof second === "string") {
      options = {
        userId: second,
        tenantId: third ?? "",
        ...(fourth !== undefined ? { courseIds: fourth } : {}),
        ...(fifth !== undefined ? { round: fifth } : {}),
      };
    } else {
      options = second as UserCoursesProgressOptions;
    }
  } else {
    if (!defaultProgressDb) {
      throw new Error(
        "getUserCoursesProgress requires a db instance as the first argument, or call setDefaultProgressDb(db).",
      );
    }
    db = defaultProgressDb;
    options = first as UserCoursesProgressOptions;
  }

  if (!options?.userId || !options?.tenantId) {
    return [];
  }

  let targetCourseIds: string[] = [];

  if (options.courseIds !== undefined) {
    if (options.courseIds.length === 0) {
      return [];
    }

    const validTenantCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.tenantId, options.tenantId), inArray(courses.id, options.courseIds)));

    const validSet = new Set(validTenantCourses.map((c) => c.id));
    targetCourseIds = options.courseIds.filter((id) => validSet.has(id));
  } else {
    const enrolledRows = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(and(eq(enrollments.userId, options.userId), eq(courses.tenantId, options.tenantId)));

    const progressRows = await db
      .select({ courseId: lessonProgress.courseId })
      .from(lessonProgress)
      .innerJoin(courses, eq(courses.id, lessonProgress.courseId))
      .where(
        and(
          eq(lessonProgress.userId, options.userId),
          eq(lessonProgress.tenantId, options.tenantId),
          eq(courses.tenantId, options.tenantId),
        ),
      );

    const idSet = new Set<string>();
    for (const r of enrolledRows) idSet.add(r.courseId);
    for (const r of progressRows) idSet.add(r.courseId);

    targetCourseIds = Array.from(idSet);
  }

  if (targetCourseIds.length === 0) {
    return [];
  }

  const [totalRows, completedRows] = await Promise.all([
    db
      .select({
        courseId: modules.courseId,
        total: sql<number>`coalesce(count(${lessons.id}), 0)::int`,
      })
      .from(modules)
      .innerJoin(lessons, and(eq(lessons.moduleId, modules.id), eq(lessons.status, "published")))
      .where(inArray(modules.courseId, targetCourseIds))
      .groupBy(modules.courseId),
    db
      .select({
        courseId: lessonProgress.courseId,
        completed: sql<number>`coalesce(count(${lessonProgress.id}), 0)::int`,
      })
      .from(lessonProgress)
      .innerJoin(
        lessons,
        and(eq(lessons.id, lessonProgress.lessonId), eq(lessons.status, "published")),
      )
      .where(
        and(
          eq(lessonProgress.userId, options.userId),
          eq(lessonProgress.tenantId, options.tenantId),
          eq(lessonProgress.completed, true),
          inArray(lessonProgress.courseId, targetCourseIds),
        ),
      )
      .groupBy(lessonProgress.courseId),
  ]);

  const totalMap = new Map<string, number>();
  for (const row of totalRows) {
    totalMap.set(row.courseId, Number(row.total));
  }

  const completedMap = new Map<string, number>();
  for (const row of completedRows) {
    completedMap.set(row.courseId, Number(row.completed));
  }

  return targetCourseIds.map((courseId) => {
    const totalLessons = totalMap.get(courseId) ?? 0;
    const completedLessons = completedMap.get(courseId) ?? 0;
    const percent = calculateProgressPercent(completedLessons, totalLessons, options.round);
    return {
      courseId,
      totalLessons,
      completedLessons,
      percent,
    };
  });
}

/**
 * Convenience helper returning a Map of courseId -> CourseProgress.
 */
export async function getUserCoursesProgressMap(
  options: UserCoursesProgressOptions,
): Promise<Map<string, CourseProgress>>;
export async function getUserCoursesProgressMap(
  db: ProgressDb,
  options: UserCoursesProgressOptions,
): Promise<Map<string, CourseProgress>>;
export async function getUserCoursesProgressMap(
  db: ProgressDb,
  userId: string,
  tenantId: string,
  courseIds?: string[],
  round?: boolean | number,
): Promise<Map<string, CourseProgress>>;
export async function getUserCoursesProgressMap(
  first: ProgressDb | UserCoursesProgressOptions,
  second?: UserCoursesProgressOptions | string,
  third?: string,
  fourth?: string[],
  fifth?: boolean | number,
): Promise<Map<string, CourseProgress>> {
  const list = await getUserCoursesProgress(
    first as never,
    second as never,
    third as never,
    fourth as never,
    fifth as never,
  );
  const map = new Map<string, CourseProgress>();
  for (const item of list) {
    map.set(item.courseId, item);
  }
  return map;
}
