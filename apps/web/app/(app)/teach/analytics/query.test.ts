import type * as LaganDb from "@lagan/db";
import type { CourseMetrics, CourseTrendBucket, LessonDropOffMetric } from "@lagan/db";
import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const selectResult: unknown[] = [];
  const selectMock = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(async () => selectResult),
      })),
    })),
  }));
  return { selectResult, selectMock };
});

const analyticsDbMock = vi.hoisted(() => {
  const getAuthorCoursesMetricsMock = vi.fn<(...args: unknown[]) => Promise<CourseMetrics[]>>(
    async () => [],
  );
  const getCourseTrendMetricsMock = vi.fn<
    (...args: unknown[]) => Promise<CourseTrendBucket[] | null>
  >(async () => []);
  const getLessonDropOffMetricsMock = vi.fn<
    (...args: unknown[]) => Promise<LessonDropOffMetric[] | null>
  >(async () => []);

  return {
    getAuthorCoursesMetricsMock,
    getCourseTrendMetricsMock,
    getLessonDropOffMetricsMock,
  };
});

vi.mock("../../../../lib/db", () => ({
  db: {
    select: dbMock.selectMock,
  },
}));

vi.mock("@lagan/db", async (importOriginal) => {
  const actual = await importOriginal<typeof LaganDb>();
  return {
    ...actual,
    getAuthorCoursesMetrics: analyticsDbMock.getAuthorCoursesMetricsMock,
    getCourseTrendMetrics: analyticsDbMock.getCourseTrendMetricsMock,
    getLessonDropOffMetrics: analyticsDbMock.getLessonDropOffMetricsMock,
  };
});

import {
  formatTrendBucketLabel,
  getDateRangeWindow,
  getTrendInterval,
  loadAuthorAnalyticsData,
  parseAnalyticsParams,
} from "./query";

describe("analytics query utilities", () => {
  describe("parseAnalyticsParams", () => {
    it("defaults to 30d range and null courseId when params are empty", () => {
      const parsed = parseAnalyticsParams({});
      expect(parsed).toEqual({ range: "30d", courseId: null });
    });

    it("parses valid date ranges", () => {
      expect(parseAnalyticsParams({ range: "7d" }).range).toBe("7d");
      expect(parseAnalyticsParams({ range: "30d" }).range).toBe("30d");
      expect(parseAnalyticsParams({ range: "90d" }).range).toBe("90d");
      expect(parseAnalyticsParams({ range: "all" }).range).toBe("all");
    });

    it("falls back to 30d on invalid range parameter", () => {
      expect(parseAnalyticsParams({ range: "invalid" }).range).toBe("30d");
      expect(parseAnalyticsParams({ range: "" }).range).toBe("30d");
    });

    it("handles array parameter formats", () => {
      expect(parseAnalyticsParams({ range: ["7d", "90d"] }).range).toBe("7d");
    });

    it("parses courseId and treats 'all' or empty string as null", () => {
      expect(parseAnalyticsParams({ courseId: "course_1" }).courseId).toBe("course_1");
      expect(parseAnalyticsParams({ courseId: "all" }).courseId).toBeNull();
      expect(parseAnalyticsParams({ courseId: "   " }).courseId).toBeNull();
      expect(parseAnalyticsParams({ courseId: ["course_2"] }).courseId).toBe("course_2");
    });
  });

  describe("getDateRangeWindow", () => {
    const fixedNow = new Date("2026-10-19T12:00:00Z");

    it("calculates 7-day window", () => {
      const window = getDateRangeWindow("7d", fixedNow);
      expect(window.to?.toISOString()).toBe(fixedNow.toISOString());
      expect(window.from?.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    });

    it("calculates 30-day window", () => {
      const window = getDateRangeWindow("30d", fixedNow);
      expect(window.to?.toISOString()).toBe(fixedNow.toISOString());
      expect(window.from?.toISOString()).toBe("2026-09-19T12:00:00.000Z");
    });

    it("calculates 90-day window", () => {
      const window = getDateRangeWindow("90d", fixedNow);
      expect(window.to?.toISOString()).toBe(fixedNow.toISOString());
      expect(window.from?.toISOString()).toBe("2026-07-21T12:00:00.000Z");
    });

    it("returns empty bounds for 'all'", () => {
      const window = getDateRangeWindow("all", fixedNow);
      expect(window.from).toBeUndefined();
      expect(window.to).toBeUndefined();
    });
  });

  describe("getTrendInterval", () => {
    it("maps range to appropriate intervals", () => {
      expect(getTrendInterval("7d")).toBe("day");
      expect(getTrendInterval("30d")).toBe("day");
      expect(getTrendInterval("90d")).toBe("week");
      expect(getTrendInterval("all")).toBe("month");
    });
  });

  describe("formatTrendBucketLabel", () => {
    it("formats day and week buckets with month and day", () => {
      const d = new Date("2026-10-15T00:00:00Z");
      expect(formatTrendBucketLabel(d, "day")).toBe("Oct 15");
      expect(formatTrendBucketLabel(d, "week")).toBe("Oct 15");
    });

    it("formats month buckets with month and year", () => {
      const d = new Date("2026-10-15T00:00:00Z");
      expect(formatTrendBucketLabel(d, "month")).toBe("Oct 2026");
    });
  });

  describe("loadAuthorAnalyticsData", () => {
    const AUTHOR_ID = "author_123";

    it("returns zeroed overview and empty points when author has no courses", async () => {
      dbMock.selectResult.length = 0;

      const data = await loadAuthorAnalyticsData({
        authorId: AUTHOR_ID,
        range: "30d",
      });

      expect(data.courses).toHaveLength(0);
      expect(data.overview).toEqual({
        totalEnrolments: 0,
        starts: 0,
        completions: 0,
        dropOffs: 0,
        completionRate: 0,
      });
      expect(data.hasNoEvents).toBe(true);
      expect(data.trendPoints).toEqual([]);
      expect(data.dropoffPoints).toEqual([]);
    });

    it("aggregates overview across all author courses when courseId is not specified", async () => {
      dbMock.selectResult.length = 0;
      dbMock.selectResult.push(
        { id: "c_1", title: "Distributed Systems", status: "published" },
        { id: "c_2", title: "Type-Driven Design", status: "published" },
      );

      analyticsDbMock.getAuthorCoursesMetricsMock.mockResolvedValueOnce([
        {
          courseId: "c_1",
          enrolments: 10,
          totalEnrolments: 10,
          starts: 8,
          completions: 4,
          dropOffs: 2,
          completionRate: 0.5,
        },
        {
          courseId: "c_2",
          enrolments: 20,
          totalEnrolments: 20,
          starts: 12,
          completions: 6,
          dropOffs: 3,
          completionRate: 0.5,
        },
      ]);

      const bucketDate = new Date("2026-10-01T00:00:00Z");
      analyticsDbMock.getCourseTrendMetricsMock.mockResolvedValueOnce([
        {
          period: bucketDate.toISOString(),
          date: bucketDate,
          enrolments: 5,
          totalEnrolments: 5,
          starts: 4,
          completions: 2,
          dropOffs: 1,
          completionRate: 0.5,
        },
      ]);

      analyticsDbMock.getLessonDropOffMetricsMock.mockResolvedValueOnce([
        {
          lessonId: "l_1",
          title: "Intro",
          lessonTitle: "Intro",
          moduleId: "m_1",
          position: 1,
          views: 10,
          completions: 8,
          dropOffs: 2,
          drops: 2,
          dropOffRate: 0.2,
        },
      ]);

      const data = await loadAuthorAnalyticsData({
        authorId: AUTHOR_ID,
        range: "30d",
      });

      expect(data.courses).toHaveLength(2);
      expect(data.overview.totalEnrolments).toBe(30);
      expect(data.overview.starts).toBe(20);
      expect(data.overview.completions).toBe(10);
      expect(data.overview.dropOffs).toBe(5);
      expect(data.overview.completionRate).toBe(0.5);
      expect(data.hasNoEvents).toBe(false);

      expect(data.trendPoints).toHaveLength(1);
      expect(data.trendPoints[0]?.value).toBe(5);
      expect(data.trendPoints[0]?.secondaryValue).toBe(4);

      expect(data.dropoffPoints).toHaveLength(1);
      expect(data.dropoffPoints[0]?.lessonTitle).toBe("Intro");
      expect(data.dropoffPoints[0]?.completedCount).toBe(8);
      expect(data.dropoffPoints[0]?.startedCount).toBe(10);
      expect(data.dropoffPoints[0]?.dropoffRate).toBe(0.2);
    });

    it("filters overview to specific course when courseId matches an author course", async () => {
      dbMock.selectResult.length = 0;
      dbMock.selectResult.push(
        { id: "c_1", title: "Distributed Systems", status: "published" },
        { id: "c_2", title: "Type-Driven Design", status: "published" },
      );

      analyticsDbMock.getAuthorCoursesMetricsMock.mockResolvedValueOnce([
        {
          courseId: "c_1",
          enrolments: 10,
          totalEnrolments: 10,
          starts: 8,
          completions: 4,
          dropOffs: 2,
          completionRate: 0.5,
        },
        {
          courseId: "c_2",
          enrolments: 20,
          totalEnrolments: 20,
          starts: 12,
          completions: 6,
          dropOffs: 3,
          completionRate: 0.5,
        },
      ]);

      analyticsDbMock.getCourseTrendMetricsMock.mockResolvedValueOnce([]);
      analyticsDbMock.getLessonDropOffMetricsMock.mockResolvedValueOnce([]);

      const data = await loadAuthorAnalyticsData({
        authorId: AUTHOR_ID,
        range: "30d",
        courseId: "c_2",
      });

      expect(data.selectedCourseId).toBe("c_2");
      expect(data.overview.totalEnrolments).toBe(20);
      expect(data.overview.starts).toBe(12);
      expect(data.overview.completions).toBe(6);
      expect(data.overview.completionRate).toBe(0.5);
    });

    it("ignores unowned courseId and falls back to aggregated all-courses view", async () => {
      dbMock.selectResult.length = 0;
      dbMock.selectResult.push({
        id: "c_1",
        title: "Distributed Systems",
        status: "published",
      });

      analyticsDbMock.getAuthorCoursesMetricsMock.mockResolvedValueOnce([
        {
          courseId: "c_1",
          enrolments: 10,
          totalEnrolments: 10,
          starts: 5,
          completions: 2,
          dropOffs: 1,
          completionRate: 0.4,
        },
      ]);

      analyticsDbMock.getCourseTrendMetricsMock.mockResolvedValueOnce([]);
      analyticsDbMock.getLessonDropOffMetricsMock.mockResolvedValueOnce([]);

      const data = await loadAuthorAnalyticsData({
        authorId: AUTHOR_ID,
        range: "30d",
        courseId: "foreign_course_xyz",
      });

      expect(data.selectedCourseId).toBeNull();
      expect(data.overview.totalEnrolments).toBe(10);
    });
  });
});
