import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { courses, lessons, modules } from "./schema/course";
import { enrollments } from "./schema/enrollment";
import { courseEvent } from "./schema/event";

export type AnalyticsDb = Pick<NodePgDatabase<Record<string, never>>, "select">;

export interface DateWindow {
  from?: Date | string | null;
  to?: Date | string | null;
}

export interface CourseMetricsOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
}

export interface CourseMetrics {
  courseId: string;
  enrolments: number;
  totalEnrolments: number;
  starts: number;
  completions: number;
  dropOffs: number;
  completionRate: number;
}

export interface AuthorCoursesMetricsOptions extends DateWindow {
  authorId: string;
  tenantId: string;
}

export interface LessonDropOffOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
}

export interface LessonDropOffMetric {
  lessonId: string;
  title: string;
  lessonTitle: string;
  moduleId: string;
  position: number;
  views: number;
  completions: number;
  dropOffs: number;
  drops: number;
  dropOffRate: number;
}

export type TrendInterval = "day" | "week" | "month";

export interface CourseTrendOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
  interval?: TrendInterval;
}

export interface CourseTrendBucket {
  period: string;
  date: Date;
  enrolments: number;
  totalEnrolments: number;
  starts: number;
  completions: number;
  dropOffs: number;
  completionRate: number;
}

export function calculateCompletionRate(completions: number, starts: number): number {
  if (starts <= 0 || !Number.isFinite(starts)) return 0;
  if (completions <= 0 || !Number.isFinite(completions)) return 0;
  return completions / starts;
}

export function calculateDropOffRate(dropOffs: number, views: number): number {
  if (views <= 0 || !Number.isFinite(views)) return 0;
  if (dropOffs <= 0 || !Number.isFinite(dropOffs)) return 0;
  return dropOffs / views;
}

function parseDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function getCourseMetrics(
  db: AnalyticsDb,
  options: CourseMetricsOptions,
): Promise<CourseMetrics | null> {
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, options.courseId),
        eq(courses.authorId, options.authorId),
        eq(courses.tenantId, options.tenantId),
      ),
    );

  if (!course) {
    return null;
  }

  const enrollmentConditions = [eq(enrollments.courseId, options.courseId)];
  if (fromDate) enrollmentConditions.push(gte(enrollments.enrolledAt, fromDate));
  if (toDate) enrollmentConditions.push(lte(enrollments.enrolledAt, toDate));

  const eventConditions = [
    eq(courseEvent.courseId, options.courseId),
    eq(courseEvent.tenantId, options.tenantId),
  ];
  if (fromDate) eventConditions.push(gte(courseEvent.createdAt, fromDate));
  if (toDate) eventConditions.push(lte(courseEvent.createdAt, toDate));

  const [enrollmentRes, eventRes] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(count(${enrollments.id}), 0)::int`,
      })
      .from(enrollments)
      .where(and(...enrollmentConditions)),
    db
      .select({
        starts: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'view' then ${courseEvent.userId} end), 0)::int`,
        completions: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'complete' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
        dropOffs: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'drop' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
      })
      .from(courseEvent)
      .where(and(...eventConditions)),
  ]);

  const totalEnrolments = Number(enrollmentRes[0]?.total ?? 0);
  const starts = Number(eventRes[0]?.starts ?? 0);
  const completions = Number(eventRes[0]?.completions ?? 0);
  const dropOffs = Number(eventRes[0]?.dropOffs ?? 0);
  const completionRate = calculateCompletionRate(completions, starts);

  return {
    courseId: options.courseId,
    enrolments: totalEnrolments,
    totalEnrolments,
    starts,
    completions,
    dropOffs,
    completionRate,
  };
}

export async function getAuthorCoursesMetrics(
  db: AnalyticsDb,
  options: AuthorCoursesMetricsOptions,
): Promise<CourseMetrics[]> {
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);

  const authorCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.authorId, options.authorId),
        eq(courses.tenantId, options.tenantId),
      ),
    );

  if (authorCourses.length === 0) {
    return [];
  }

  const courseIds = authorCourses.map((c) => c.id);

  const enrollmentConditions = [inArray(enrollments.courseId, courseIds)];
  if (fromDate) enrollmentConditions.push(gte(enrollments.enrolledAt, fromDate));
  if (toDate) enrollmentConditions.push(lte(enrollments.enrolledAt, toDate));

  const eventConditions = [
    inArray(courseEvent.courseId, courseIds),
    eq(courseEvent.tenantId, options.tenantId),
  ];
  if (fromDate) eventConditions.push(gte(courseEvent.createdAt, fromDate));
  if (toDate) eventConditions.push(lte(courseEvent.createdAt, toDate));

  const [enrollmentRows, eventRows] = await Promise.all([
    db
      .select({
        courseId: enrollments.courseId,
        total: sql<number>`coalesce(count(${enrollments.id}), 0)::int`,
      })
      .from(enrollments)
      .where(and(...enrollmentConditions))
      .groupBy(enrollments.courseId),
    db
      .select({
        courseId: courseEvent.courseId,
        starts: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'view' then ${courseEvent.userId} end), 0)::int`,
        completions: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'complete' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
        dropOffs: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'drop' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
      })
      .from(courseEvent)
      .where(and(...eventConditions))
      .groupBy(courseEvent.courseId),
  ]);

  const enrollmentsByCourse = new Map<string, number>();
  for (const row of enrollmentRows) {
    enrollmentsByCourse.set(row.courseId, Number(row.total));
  }

  const eventsByCourse = new Map<
    string,
    { starts: number; completions: number; dropOffs: number }
  >();
  for (const row of eventRows) {
    eventsByCourse.set(row.courseId, {
      starts: Number(row.starts),
      completions: Number(row.completions),
      dropOffs: Number(row.dropOffs),
    });
  }

  return authorCourses.map((c) => {
    const totalEnrolments = enrollmentsByCourse.get(c.id) ?? 0;
    const ev = eventsByCourse.get(c.id) ?? { starts: 0, completions: 0, dropOffs: 0 };
    return {
      courseId: c.id,
      enrolments: totalEnrolments,
      totalEnrolments,
      starts: ev.starts,
      completions: ev.completions,
      dropOffs: ev.dropOffs,
      completionRate: calculateCompletionRate(ev.completions, ev.starts),
    };
  });
}

export async function getLessonDropOffMetrics(
  db: AnalyticsDb,
  options: LessonDropOffOptions,
): Promise<LessonDropOffMetric[] | null> {
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, options.courseId),
        eq(courses.authorId, options.authorId),
        eq(courses.tenantId, options.tenantId),
      ),
    );

  if (!course) {
    return null;
  }

  const courseLessons = await db
    .select({
      lessonId: lessons.id,
      title: lessons.title,
      moduleId: modules.id,
      position: lessons.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, options.courseId))
    .orderBy(asc(modules.position), asc(lessons.position));

  if (courseLessons.length === 0) {
    return [];
  }

  const eventConditions = [
    eq(courseEvent.courseId, options.courseId),
    eq(courseEvent.tenantId, options.tenantId),
    isNotNull(courseEvent.lessonId),
  ];
  if (fromDate) eventConditions.push(gte(courseEvent.createdAt, fromDate));
  if (toDate) eventConditions.push(lte(courseEvent.createdAt, toDate));

  const lessonEvents = await db
    .select({
      lessonId: courseEvent.lessonId,
      views: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'view' then ${courseEvent.userId} end), 0)::int`,
      completions: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'complete' then ${courseEvent.userId} end), 0)::int`,
      dropOffs: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'drop' then ${courseEvent.userId} end), 0)::int`,
    })
    .from(courseEvent)
    .where(and(...eventConditions))
    .groupBy(courseEvent.lessonId);

  const statsByLesson = new Map<
    string,
    { views: number; completions: number; dropOffs: number }
  >();
  for (const row of lessonEvents) {
    if (row.lessonId) {
      statsByLesson.set(row.lessonId, {
        views: Number(row.views),
        completions: Number(row.completions),
        dropOffs: Number(row.dropOffs),
      });
    }
  }

  return courseLessons.map((l) => {
    const stats = statsByLesson.get(l.lessonId) ?? { views: 0, completions: 0, dropOffs: 0 };
    return {
      lessonId: l.lessonId,
      title: l.title,
      lessonTitle: l.title,
      moduleId: l.moduleId,
      position: l.position,
      views: stats.views,
      completions: stats.completions,
      dropOffs: stats.dropOffs,
      drops: stats.dropOffs,
      dropOffRate: calculateDropOffRate(stats.dropOffs, stats.views),
    };
  });
}

export async function getCourseTrendMetrics(
  db: AnalyticsDb,
  options: CourseTrendOptions,
): Promise<CourseTrendBucket[] | null> {
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);
  const interval = options.interval ?? "day";

  if (!["day", "week", "month"].includes(interval)) {
    throw new Error(`Invalid trend interval: ${interval}`);
  }

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, options.courseId),
        eq(courses.authorId, options.authorId),
        eq(courses.tenantId, options.tenantId),
      ),
    );

  if (!course) {
    return null;
  }

  const intervalSql = sql.raw(`'${interval}'`);
  const enrollmentPeriodSql = sql<string>`date_trunc(${intervalSql}, ${enrollments.enrolledAt})`;

  const enrollmentConditions = [eq(enrollments.courseId, options.courseId)];
  if (fromDate) enrollmentConditions.push(gte(enrollments.enrolledAt, fromDate));
  if (toDate) enrollmentConditions.push(lte(enrollments.enrolledAt, toDate));

  const eventPeriodSql = sql<string>`date_trunc(${intervalSql}, ${courseEvent.createdAt})`;

  const eventConditions = [
    eq(courseEvent.courseId, options.courseId),
    eq(courseEvent.tenantId, options.tenantId),
  ];
  if (fromDate) eventConditions.push(gte(courseEvent.createdAt, fromDate));
  if (toDate) eventConditions.push(lte(courseEvent.createdAt, toDate));

  const [enrollmentRows, eventRows] = await Promise.all([
    db
      .select({
        bucket: enrollmentPeriodSql,
        total: sql<number>`coalesce(count(${enrollments.id}), 0)::int`,
      })
      .from(enrollments)
      .where(and(...enrollmentConditions))
      .groupBy(enrollmentPeriodSql)
      .orderBy(asc(enrollmentPeriodSql)),
    db
      .select({
        bucket: eventPeriodSql,
        starts: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'view' then ${courseEvent.userId} end), 0)::int`,
        completions: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'complete' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
        dropOffs: sql<number>`coalesce(count(distinct case when ${courseEvent.type} = 'drop' and ${courseEvent.lessonId} is null then ${courseEvent.userId} end), 0)::int`,
      })
      .from(courseEvent)
      .where(and(...eventConditions))
      .groupBy(eventPeriodSql)
      .orderBy(asc(eventPeriodSql)),
  ]);

  const buckets = new Map<
    string,
    { date: Date; enrolments: number; starts: number; completions: number; dropOffs: number }
  >();

  for (const row of enrollmentRows) {
    if (!row.bucket) continue;
    const date = new Date(row.bucket);
    const key = date.toISOString();
    const entry = buckets.get(key) ?? {
      date,
      enrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
    };
    entry.enrolments += Number(row.total);
    buckets.set(key, entry);
  }

  for (const row of eventRows) {
    if (!row.bucket) continue;
    const date = new Date(row.bucket);
    const key = date.toISOString();
    const entry = buckets.get(key) ?? {
      date,
      enrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
    };
    entry.starts += Number(row.starts);
    entry.completions += Number(row.completions);
    entry.dropOffs += Number(row.dropOffs);
    buckets.set(key, entry);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      period: key,
      date: b.date,
      enrolments: b.enrolments,
      totalEnrolments: b.enrolments,
      starts: b.starts,
      completions: b.completions,
      dropOffs: b.dropOffs,
      completionRate: calculateCompletionRate(b.completions, b.starts),
    }));
}
