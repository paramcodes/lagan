import { describe, expect, it, vi } from "vitest";
import {
  calculateCourseProgressPercent,
  calculateProgressPercent,
  getCourseProgress,
  getCourseProgressSummary,
  getUserCoursesProgress,
  getUserCoursesProgressMap,
  setDefaultProgressDb,
} from "./progress";

describe("progress pure math and summary helpers", () => {
  it("calculates progress percentage with zero-division and edge-case safety", () => {
    expect(calculateProgressPercent(0, 0)).toBe(0);
    expect(calculateProgressPercent(5, 0)).toBe(0);
    expect(calculateProgressPercent(0, 5)).toBe(0);
    expect(calculateProgressPercent(-1, 5)).toBe(0);
    expect(calculateProgressPercent(2, -5)).toBe(0);
    expect(calculateProgressPercent(Number.NaN, 10)).toBe(0);
    expect(calculateProgressPercent(5, Number.NaN)).toBe(0);
    expect(calculateProgressPercent(5, Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateProgressPercent(Number.POSITIVE_INFINITY, 5)).toBe(0);
  });

  it("calculates accurate percentages for partial and full completion", () => {
    expect(calculateProgressPercent(1, 4)).toBe(25);
    expect(calculateProgressPercent(1, 2)).toBe(50);
    expect(calculateProgressPercent(3, 4)).toBe(75);
    expect(calculateProgressPercent(4, 4)).toBe(100);
    expect(calculateProgressPercent(1, 8)).toBe(12.5);
    expect(calculateProgressPercent(6, 5)).toBe(100);
  });

  it("supports rounding and precision options", () => {
    expect(calculateProgressPercent(1, 3)).toBeCloseTo(33.3333, 3);
    expect(calculateProgressPercent(1, 3, true)).toBe(33);
    expect(calculateProgressPercent(1, 3, { round: true })).toBe(33);
    expect(calculateProgressPercent(1, 3, 2)).toBe(33.33);
    expect(calculateProgressPercent(1, 3, { precision: 2 })).toBe(33.33);
    expect(calculateProgressPercent(1, 3, 1)).toBe(33.3);
  });

  it("exports calculateCourseProgressPercent as an alias", () => {
    expect(calculateCourseProgressPercent(2, 4)).toBe(50);
  });

  it("generates UI-friendly course progress summary", () => {
    const zero = getCourseProgressSummary(0, 0);
    expect(zero).toEqual({
      courseId: "",
      totalLessons: 0,
      completedLessons: 0,
      percent: 0,
      formatted: "0 of 0 lessons",
      isCompleted: false,
    });

    const single = getCourseProgressSummary(1, 1, { courseId: "c_one" });
    expect(single).toEqual({
      courseId: "c_one",
      totalLessons: 1,
      completedLessons: 1,
      percent: 100,
      formatted: "1 of 1 lesson",
      isCompleted: true,
    });

    const partial = getCourseProgressSummary(6, 10, { courseId: "c_part" });
    expect(partial).toEqual({
      courseId: "c_part",
      totalLessons: 10,
      completedLessons: 6,
      percent: 60,
      formatted: "6 of 10 lessons",
      isCompleted: false,
    });

    const full = getCourseProgressSummary(10, 10, { courseId: "c_full" });
    expect(full).toEqual({
      courseId: "c_full",
      totalLessons: 10,
      completedLessons: 10,
      percent: 100,
      formatted: "10 of 10 lessons",
      isCompleted: true,
    });
  });
});

describe("getCourseProgress unit tests with mocked executor", () => {
  const USER_ID = "usr_alice";
  const TENANT_ID = "tenant_main";
  const COURSE_ID = "crs_101";

  it("returns null if course does not exist in the specified tenant", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };

    const res = await getCourseProgress(mockDb as never, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });

    expect(res).toBeNull();
  });

  it("returns null if required parameters are missing", async () => {
    const mockDb = { select: vi.fn() };
    const res = await getCourseProgress(mockDb as never, {
      userId: "",
      tenantId: TENANT_ID,
      courseId: COURSE_ID,
    });
    expect(res).toBeNull();
  });

  it("returns 0 total, 0 completed, 0% for course with zero lessons", async () => {
    let callIndex = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          callIndex++;
          if (callIndex === 1) {
            return { where: vi.fn().mockResolvedValue([{ id: COURSE_ID }]) };
          }
          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([]),
            })),
          };
        }),
      })),
    };

    const res = await getCourseProgress(mockDb as never, USER_ID, COURSE_ID, TENANT_ID);
    expect(res).toEqual({
      courseId: COURSE_ID,
      totalLessons: 0,
      completedLessons: 0,
      percent: 0,
    });
  });

  it("aggregates partial completion accurately", async () => {
    let callIndex = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          callIndex++;
          if (callIndex === 1) {
            return { where: vi.fn().mockResolvedValue([{ id: COURSE_ID }]) };
          }
          if (callIndex === 2) {
            return {
              innerJoin: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ total: 10 }]),
              })),
            };
          }
          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ completed: 6 }]),
            })),
          };
        }),
      })),
    };

    const res = await getCourseProgress(mockDb as never, {
      userId: USER_ID,
      courseId: COURSE_ID,
      tenantId: TENANT_ID,
    });

    expect(res).toEqual({
      courseId: COURSE_ID,
      totalLessons: 10,
      completedLessons: 6,
      percent: 60,
    });
  });
});

describe("getUserCoursesProgress unit tests with mocked executor", () => {
  const USER_ID = "usr_alice";
  const TENANT_ID = "tenant_main";

  it("returns empty array when user has no enrolled or progress courses", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    };

    const res = await getUserCoursesProgress(mockDb as never, USER_ID, TENANT_ID);
    expect(res).toEqual([]);
  });

  it("returns empty array when empty courseIds array is provided", async () => {
    const mockDb = { select: vi.fn() };
    const res = await getUserCoursesProgress(mockDb as never, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      courseIds: [],
    });
    expect(res).toEqual([]);
  });

  it("filters out courseIds that belong to a different tenant", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };

    const res = await getUserCoursesProgress(mockDb as never, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      courseIds: ["foreign_course_1"],
    });

    expect(res).toEqual([]);
  });

  it("batch calculates progress across multiple courses", async () => {
    let callIndex = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          callIndex++;
          if (callIndex === 1) {
            return {
              where: vi.fn().mockResolvedValue([{ id: "c1" }, { id: "c2" }, { id: "c3_zero" }]),
            };
          }
          if (callIndex === 2) {
            return {
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  groupBy: vi.fn().mockResolvedValue([
                    { courseId: "c1", total: 4 },
                    { courseId: "c2", total: 10 },
                  ]),
                })),
              })),
            };
          }
          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                groupBy: vi.fn().mockResolvedValue([
                  { courseId: "c1", completed: 4 },
                  { courseId: "c2", completed: 5 },
                ]),
              })),
            })),
          };
        }),
      })),
    };

    const res = await getUserCoursesProgress(mockDb as never, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      courseIds: ["c1", "c2", "c3_zero"],
    });

    expect(res).toEqual([
      {
        courseId: "c1",
        totalLessons: 4,
        completedLessons: 4,
        percent: 100,
      },
      {
        courseId: "c2",
        totalLessons: 10,
        completedLessons: 5,
        percent: 50,
      },
      {
        courseId: "c3_zero",
        totalLessons: 0,
        completedLessons: 0,
        percent: 0,
      },
    ]);
  });

  it("returns a map from getUserCoursesProgressMap", async () => {
    let callIndex = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          callIndex++;
          if (callIndex === 1) {
            return { where: vi.fn().mockResolvedValue([{ id: "c1" }]) };
          }
          if (callIndex === 2) {
            return {
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  groupBy: vi.fn().mockResolvedValue([{ courseId: "c1", total: 2 }]),
                })),
              })),
            };
          }
          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                groupBy: vi.fn().mockResolvedValue([{ courseId: "c1", completed: 1 }]),
              })),
            })),
          };
        }),
      })),
    };

    const map = await getUserCoursesProgressMap(mockDb as never, USER_ID, TENANT_ID, ["c1"]);
    expect(map.get("c1")).toEqual({
      courseId: "c1",
      totalLessons: 2,
      completedLessons: 1,
      percent: 50,
    });
  });

  it("uses setDefaultProgressDb when db instance is omitted", async () => {
    let callIndex = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          callIndex++;
          if (callIndex === 1) {
            return { where: vi.fn().mockResolvedValue([{ id: "c1" }]) };
          }
          if (callIndex === 2) {
            return {
              innerJoin: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ total: 2 }]),
              })),
            };
          }
          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ completed: 2 }]),
            })),
          };
        }),
      })),
    };

    setDefaultProgressDb(mockDb as never);
    const res = await getCourseProgress({
      userId: USER_ID,
      courseId: "c1",
      tenantId: TENANT_ID,
    });

    expect(res).toEqual({
      courseId: "c1",
      totalLessons: 2,
      completedLessons: 2,
      percent: 100,
    });

    setDefaultProgressDb(null);
    await expect(
      getCourseProgress({
        userId: USER_ID,
        courseId: "c1",
        tenantId: TENANT_ID,
      }),
    ).rejects.toThrow("setDefaultProgressDb");
  });
});
