import {
  calculateCompletionRate,
  courses,
  getAuthorCoursesMetrics,
  getCourseTrendMetrics,
  getLessonDropOffMetrics,
  type TrendInterval,
} from "@lagan/db";
import type { LessonDropoffPoint, TrendPoint } from "@lagan/ui";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import type {
  AnalyticsOverviewMetrics,
  AuthorAnalyticsData,
  CourseSummaryItem,
  DateRangeKey,
} from "./types";

export const DEFAULT_TENANT_ID = "default";
export const VALID_DATE_RANGES: readonly DateRangeKey[] = ["7d", "30d", "90d", "all"] as const;

export function parseAnalyticsParams(
  searchParams?: Record<string, string | string[] | undefined>,
): {
  range: DateRangeKey;
  courseId: string | null;
} {
  const rawRange = searchParams?.range;
  const rangeValue = Array.isArray(rawRange) ? rawRange[0] : rawRange;
  const range: DateRangeKey =
    rangeValue && (VALID_DATE_RANGES as readonly string[]).includes(rangeValue)
      ? (rangeValue as DateRangeKey)
      : "30d";

  const rawCourseId = searchParams?.courseId;
  const courseIdValue = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;
  const courseId =
    courseIdValue && courseIdValue !== "all" && courseIdValue.trim().length > 0
      ? courseIdValue.trim()
      : null;

  return { range, courseId };
}

export function getDateRangeWindow(
  range: DateRangeKey,
  now = new Date(),
): { from?: Date; to?: Date } {
  const to = new Date(now);
  switch (range) {
    case "7d": {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 7);
      return { from, to };
    }
    case "30d": {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      return { from, to };
    }
    case "90d": {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 90);
      return { from, to };
    }
    default:
      return {};
  }
}

export function getTrendInterval(range: DateRangeKey): TrendInterval {
  switch (range) {
    case "7d":
    case "30d":
      return "day";
    case "90d":
      return "week";
    case "all":
      return "month";
    default:
      return "day";
  }
}

export function formatTrendBucketLabel(date: Date, interval: TrendInterval): string {
  if (interval === "month") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface LoadAuthorAnalyticsOptions {
  authorId: string;
  tenantId?: string;
  range?: DateRangeKey;
  courseId?: string | null;
  now?: Date;
}

export async function loadAuthorAnalyticsData({
  authorId,
  tenantId = DEFAULT_TENANT_ID,
  range = "30d",
  courseId = null,
  now = new Date(),
}: LoadAuthorAnalyticsOptions): Promise<AuthorAnalyticsData> {
  const dateWindow = getDateRangeWindow(range, now);
  const interval = getTrendInterval(range);

  const authorCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
    })
    .from(courses)
    .where(and(eq(courses.authorId, authorId), eq(courses.tenantId, tenantId)))
    .orderBy(asc(courses.createdAt));

  if (authorCourses.length === 0) {
    return {
      courses: [],
      selectedCourse: null,
      selectedCourseId: null,
      chartCourse: null,
      selectedRange: range,
      overview: {
        totalEnrolments: 0,
        starts: 0,
        completions: 0,
        dropOffs: 0,
        completionRate: 0,
      },
      trendPoints: [],
      dropoffPoints: [],
      hasNoEvents: true,
      dateWindow,
    };
  }

  const courseMetricsList = await getAuthorCoursesMetrics(db, {
    authorId,
    tenantId,
    ...(dateWindow.from ? { from: dateWindow.from } : {}),
    ...(dateWindow.to ? { to: dateWindow.to } : {}),
  });

  const metricsByCourseId: Record<string, (typeof courseMetricsList)[number]> = {};
  for (const m of courseMetricsList) {
    metricsByCourseId[m.courseId] = m;
  }

  const courseSummaries: CourseSummaryItem[] = authorCourses.map((c) => {
    const metrics = metricsByCourseId[c.id] ?? {
      courseId: c.id,
      enrolments: 0,
      totalEnrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
      completionRate: 0,
    };
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      metrics,
    };
  });

  const selectedCourse = courseId ? (courseSummaries.find((c) => c.id === courseId) ?? null) : null;
  const selectedCourseId = selectedCourse ? selectedCourse.id : null;

  let overview: AnalyticsOverviewMetrics;
  if (selectedCourse) {
    overview = {
      totalEnrolments: selectedCourse.metrics.totalEnrolments,
      starts: selectedCourse.metrics.starts,
      completions: selectedCourse.metrics.completions,
      dropOffs: selectedCourse.metrics.dropOffs,
      completionRate: selectedCourse.metrics.completionRate,
    };
  } else {
    let totalEnrolments = 0;
    let starts = 0;
    let completions = 0;
    let dropOffs = 0;

    for (const item of courseSummaries) {
      totalEnrolments += item.metrics.totalEnrolments;
      starts += item.metrics.starts;
      completions += item.metrics.completions;
      dropOffs += item.metrics.dropOffs;
    }

    overview = {
      totalEnrolments,
      starts,
      completions,
      dropOffs,
      completionRate: calculateCompletionRate(completions, starts),
    };
  }

  const chartCourse = selectedCourse ?? courseSummaries[0] ?? null;
  const chartCourseId = chartCourse?.id ?? null;

  let trendPoints: TrendPoint[] = [];
  let dropoffPoints: LessonDropoffPoint[] = [];

  if (chartCourseId) {
    const [trendBuckets, dropoffMetrics] = await Promise.all([
      getCourseTrendMetrics(db, {
        authorId,
        tenantId,
        courseId: chartCourseId,
        interval,
        ...(dateWindow.from ? { from: dateWindow.from } : {}),
        ...(dateWindow.to ? { to: dateWindow.to } : {}),
      }),
      getLessonDropOffMetrics(db, {
        authorId,
        tenantId,
        courseId: chartCourseId,
        ...(dateWindow.from ? { from: dateWindow.from } : {}),
        ...(dateWindow.to ? { to: dateWindow.to } : {}),
      }),
    ]);

    if (trendBuckets && trendBuckets.length > 0) {
      trendPoints = trendBuckets.map((bucket) => ({
        label: formatTrendBucketLabel(bucket.date, interval),
        value: bucket.enrolments,
        date: bucket.date.toISOString(),
        secondaryValue: bucket.starts,
      }));
    }

    if (dropoffMetrics && dropoffMetrics.length > 0) {
      dropoffPoints = dropoffMetrics.map((item) => ({
        lessonId: item.lessonId,
        lessonTitle: item.lessonTitle || item.title || "Untitled Lesson",
        completedCount: item.completions,
        startedCount: item.views,
        droppedCount: item.dropOffs,
        dropoffRate: item.dropOffRate,
        order: item.position,
      }));
    }
  }

  const hasNoEvents =
    overview.totalEnrolments === 0 &&
    overview.starts === 0 &&
    overview.completions === 0 &&
    trendPoints.length === 0;

  return {
    courses: courseSummaries,
    selectedCourse,
    selectedCourseId,
    chartCourse,
    selectedRange: range,
    overview,
    trendPoints,
    dropoffPoints,
    hasNoEvents,
    dateWindow,
  };
}
