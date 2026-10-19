import { describe, expect, it, vi } from "vitest";
import {
  calculateCompletionRate,
  calculateDropOffRate,
  getAuthorCoursesMetrics,
  getCourseMetrics,
  getCourseTrendMetrics,
  getLessonDropOffMetrics,
} from "./analytics";

describe("analytics pure math helpers", () => {
  it("calculates completion rate with zero-division safety", () => {
    expect(calculateCompletionRate(0, 0)).toBe(0);
    expect(calculateCompletionRate(5, 0)).toBe(0);
    expect(calculateCompletionRate(-1, 0)).toBe(0);
    expect(calculateCompletionRate(0, -5)).toBe(0);
    expect(calculateCompletionRate(25, 100)).toBe(0.25);
    expect(calculateCompletionRate(1, 1)).toBe(1.0);
    expect(calculateCompletionRate(3, 4)).toBe(0.75);
    expect(calculateCompletionRate(Number.NaN, 10)).toBe(0);
    expect(calculateCompletionRate(5, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("calculates drop-off rate with zero-division safety", () => {
    expect(calculateDropOffRate(0, 0)).toBe(0);
    expect(calculateDropOffRate(5, 0)).toBe(0);
    expect(calculateDropOffRate(-1, 0)).toBe(0);
    expect(calculateDropOffRate(0, -5)).toBe(0);
    expect(calculateDropOffRate(10, 50)).toBe(0.2);
    expect(calculateDropOffRate(1, 4)).toBe(0.25);
    expect(calculateDropOffRate(Number.NaN, 10)).toBe(0);
    expect(calculateDropOffRate(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("analytics query helpers with mocked executor", () => {
  const AUTHOR_ID = "author_1";
  const OTHER_AUTHOR_ID = "author_2";
  const TENANT_ID = "default";
  const COURSE_ID = "course_1";

  it("getCourseMetrics returns null if course is not owned by the requesting author", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };

    const metrics = await getCourseMetrics(mockDb as never, {
      authorId: OTHER_AUTHOR_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });

    expect(metrics).toBeNull();
  });

  it("getCourseMetrics returns zero counts for an empty window", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: COURSE_ID }]);
            }
            if (callCount === 2) {
              return Promise.resolve([{ total: 0 }]);
            }
            return Promise.resolve([{ starts: 0, completions: 0, dropOffs: 0 }]);
          }),
        })),
      })),
    };

    const metrics = await getCourseMetrics(mockDb as never, {
      authorId: AUTHOR_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
      from: new Date("2026-06-01"),
      to: new Date("2026-06-30"),
    });

    expect(metrics).toEqual({
      courseId: COURSE_ID,
      enrolments: 0,
      totalEnrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
      completionRate: 0,
    });
  });

  it("getCourseMetrics aggregates enrolments, starts, completions, and completion rate", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: COURSE_ID }]);
            }
            if (callCount === 2) {
              return Promise.resolve([{ total: 10 }]);
            }
            return Promise.resolve([{ starts: 8, completions: 4, dropOffs: 2 }]);
          }),
        })),
      })),
    };

    const metrics = await getCourseMetrics(mockDb as never, {
      authorId: AUTHOR_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });

    expect(metrics).toEqual({
      courseId: COURSE_ID,
      enrolments: 10,
      totalEnrolments: 10,
      starts: 8,
      completions: 4,
      dropOffs: 2,
      completionRate: 0.5,
    });
  });

  it("getAuthorCoursesMetrics returns empty array if author has no courses", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };

    const result = await getAuthorCoursesMetrics(mockDb as never, {
      authorId: AUTHOR_ID,
      tenantId: TENANT_ID,
    });

    expect(result).toEqual([]);
  });

  it("getAuthorCoursesMetrics maps multiple courses and fills zeros for inactive ones", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: "c1" }, { id: "c2" }]);
            }
            if (callCount === 2) {
              return {
                groupBy: vi.fn().mockResolvedValue([{ courseId: "c1", total: 5 }]),
              };
            }
            return {
              groupBy: vi
                .fn()
                .mockResolvedValue([
                  { courseId: "c1", starts: 4, completions: 2, dropOffs: 1 },
                ]),
            };
          }),
        })),
      })),
    };

    const result = await getAuthorCoursesMetrics(mockDb as never, {
      authorId: AUTHOR_ID,
      tenantId: TENANT_ID,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      courseId: "c1",
      enrolments: 5,
      totalEnrolments: 5,
      starts: 4,
      completions: 2,
      dropOffs: 1,
      completionRate: 0.5,
    });
    expect(result[1]).toEqual({
      courseId: "c2",
      enrolments: 0,
      totalEnrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
      completionRate: 0,
    });
  });

  it("getLessonDropOffMetrics returns null if course not owned by author", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };

    const result = await getLessonDropOffMetrics(mockDb as never, {
      authorId: OTHER_AUTHOR_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });

    expect(result).toBeNull();
  });

  it("getLessonDropOffMetrics aggregates per-lesson completions and drop-offs", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: COURSE_ID }]);
            }
            return {
              groupBy: vi.fn().mockResolvedValue([
                { lessonId: "les_1", views: 10, completions: 8, dropOffs: 2 },
                { lessonId: "les_2", views: 8, completions: 5, dropOffs: 3 },
              ]),
            };
          }),
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue([
                { lessonId: "les_1", title: "Intro", moduleId: "mod_1", position: 0 },
                { lessonId: "les_2", title: "Setup", moduleId: "mod_1", position: 1 },
                { lessonId: "les_3", title: "Deep Dive", moduleId: "mod_2", position: 0 },
              ]),
            })),
          })),
        })),
      })),
    };

    const result = await getLessonDropOffMetrics(mockDb as never, {
      authorId: AUTHOR_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });

    expect(result).toHaveLength(3);
    const l1 = result?.[0];
    const l2 = result?.[1];
    const l3 = result?.[2];

    expect(l1).toEqual({
      lessonId: "les_1",
      title: "Intro",
      lessonTitle: "Intro",
      moduleId: "mod_1",
      position: 0,
      views: 10,
      completions: 8,
      dropOffs: 2,
      drops: 2,
      dropOffRate: 0.2,
    });
    expect(l2).toEqual({
      lessonId: "les_2",
      title: "Setup",
      lessonTitle: "Setup",
      moduleId: "mod_1",
      position: 1,
      views: 8,
      completions: 5,
      dropOffs: 3,
      drops: 3,
      dropOffRate: 0.375,
    });
    expect(l3).toEqual({
      lessonId: "les_3",
      title: "Deep Dive",
      lessonTitle: "Deep Dive",
      moduleId: "mod_2",
      position: 0,
      views: 0,
      completions: 0,
      dropOffs: 0,
      drops: 0,
      dropOffRate: 0,
    });
  });

  it("getCourseTrendMetrics validates interval parameter", async () => {
    const mockDb = { select: vi.fn() };
    await expect(
      getCourseTrendMetrics(mockDb as never, {
        authorId: AUTHOR_ID,
        tenantId: TENANT_ID,
        courseId: COURSE_ID,
        interval: "invalid" as never,
      }),
    ).rejects.toThrow("Invalid trend interval");
  });
});
