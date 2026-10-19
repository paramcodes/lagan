import { describe, expect, it, vi } from "vitest";
import {
  checkCourseAccess,
  extractLessonMetadata,
  formatTotalDuration,
  getCourseDetail,
  getResumeLessonForCourse,
} from "./query";

describe("extractLessonMetadata", () => {
  it("marks first lesson of first module as preview by default", () => {
    const meta = extractLessonMetadata(
      {
        id: "l_1",
        moduleId: "m_1",
        title: "Introduction",
        type: "video",
        position: 0,
      },
      0,
    );
    expect(meta.isPreview).toBe(true);
    expect(meta.duration).toBe("10 min");
  });

  it("does not mark subsequent lessons as preview unless explicitly set", () => {
    const meta = extractLessonMetadata(
      {
        id: "l_2",
        moduleId: "m_1",
        title: "Deep Dive",
        type: "video",
        position: 1,
      },
      0,
    );
    expect(meta.isPreview).toBe(false);
  });

  it("respects explicit isPreview in contentJson", () => {
    const meta = extractLessonMetadata(
      {
        id: "l_5",
        moduleId: "m_2",
        title: "Special Preview",
        type: "text",
        position: 2,
        contentJson: { type: "doc", isPreview: true },
      },
      1,
    );
    expect(meta.isPreview).toBe(true);
    expect(meta.duration).toBe("5 min");
  });

  it("extracts duration strings and numbers from contentJson", () => {
    const stringDuration = extractLessonMetadata(
      {
        id: "l_6",
        moduleId: "m_1",
        title: "String duration",
        type: "video",
        position: 1,
        contentJson: { type: "doc", duration: "18 min" },
      },
      0,
    );
    expect(stringDuration.duration).toBe("18 min");

    const minutesDuration = extractLessonMetadata(
      {
        id: "l_7",
        moduleId: "m_1",
        title: "Minutes duration",
        type: "quiz",
        position: 2,
        contentJson: { type: "doc", durationMinutes: 25 },
      },
      0,
    );
    expect(minutesDuration.duration).toBe("25 min");

    const secondsDuration = extractLessonMetadata(
      {
        id: "l_8",
        moduleId: "m_1",
        title: "Seconds duration",
        type: "video",
        position: 3,
        contentJson: { type: "doc", durationSeconds: 300 },
      },
      0,
    );
    expect(secondsDuration.duration).toBe("5 min");
  });

  it("provides fallback duration for different lesson types", () => {
    expect(
      extractLessonMetadata({ id: "1", moduleId: "m", title: "v", type: "video", position: 1 }, 1)
        .duration,
    ).toBe("10 min");
    expect(
      extractLessonMetadata({ id: "2", moduleId: "m", title: "t", type: "text", position: 1 }, 1)
        .duration,
    ).toBe("5 min");
    expect(
      extractLessonMetadata({ id: "3", moduleId: "m", title: "q", type: "quiz", position: 1 }, 1)
        .duration,
    ).toBe("15 min");
    expect(
      extractLessonMetadata({ id: "4", moduleId: "m", title: "f", type: "file", position: 1 }, 1)
        .duration,
    ).toBe("5 min");
    expect(
      extractLessonMetadata(
        { id: "5", moduleId: "m", title: "e", type: "external", position: 1 },
        1,
      ).duration,
    ).toBe("10 min");
  });
});

describe("formatTotalDuration", () => {
  it("formats minutes into hours and minutes", () => {
    expect(formatTotalDuration(0)).toBe("0 min");
    expect(formatTotalDuration(45)).toBe("45 min");
    expect(formatTotalDuration(60)).toBe("1 hr");
    expect(formatTotalDuration(125)).toBe("2 hr 5 min");
  });
});

describe("getCourseDetail", () => {
  it("returns null if course is missing or not published", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
        })),
      })),
    };

    const result = await getCourseDetail(
      "course_missing",
      mockDb as unknown as Parameters<typeof getCourseDetail>[1],
    );
    expect(result).toBeNull();
  });

  it("returns course detail with instructor and modules/lessons", async () => {
    const courseRow = {
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
      title: "Distributed Systems in Practice",
      description: "Learn consensus and replication.",
      priceCents: 4999,
      discountPercent: 10,
      isFree: false,
      status: "published",
      version: 1,
      publishedAt: new Date("2026-03-01T00:00:00Z"),
      authorName: "Dr. Evelyn Reed",
      authorAvatarUrl: "https://example.com/avatar.jpg",
      authorBio: "Distributed systems researcher.",
      authorWebsiteUrl: "https://evelynreed.com",
    };

    const moduleRows = [
      { id: "mod_1", courseId: "course_1", title: "Foundations", position: 0 },
      { id: "mod_2", courseId: "course_1", title: "Consensus", position: 1 },
    ];

    const lessonRows = [
      {
        id: "les_1",
        moduleId: "mod_1",
        type: "video",
        title: "System Models",
        position: 0,
        status: "published",
        contentJson: { type: "doc", durationMinutes: 12 },
      },
      {
        id: "les_2",
        moduleId: "mod_2",
        type: "text",
        title: "Paxos & Raft",
        position: 0,
        status: "published",
        contentJson: { type: "doc", durationMinutes: 18, isPreview: true },
      },
    ];

    let selectCall = 0;
    const mockDb = {
      select: vi.fn(() => {
        selectCall++;
        if (selectCall === 1) {
          // Course query
          return {
            from: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue([courseRow]),
                  })),
                })),
              })),
            })),
          };
        }
        if (selectCall === 2) {
          // Modules query
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn().mockResolvedValue(moduleRows),
              })),
            })),
          };
        }
        // Lessons query
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue(lessonRows),
            })),
          })),
        };
      }),
    };

    const detail = await getCourseDetail(
      "course_1",
      mockDb as unknown as Parameters<typeof getCourseDetail>[1],
    );
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe("Distributed Systems in Practice");
    expect(detail?.instructor.name).toBe("Dr. Evelyn Reed");
    expect(detail?.modules.length).toBe(2);
    expect(detail?.totalLessons).toBe(2);
    expect(detail?.totalDuration).toBe("30 min");
    expect(detail?.modules[0]?.lessons[0]?.isPreview).toBe(true);
    expect(detail?.modules[1]?.lessons[0]?.isPreview).toBe(true);
  });
});

describe("getResumeLessonForCourse", () => {
  it("resolves resume lesson for course based on user progress", async () => {
    const lessonRows = [
      {
        courseId: "course_1",
        lessonId: "les_1",
        lessonTitle: "Lesson 1",
        modulePosition: 0,
        lessonPosition: 0,
        completed: true,
        positionSeconds: 120,
        lastSeenAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        courseId: "course_1",
        lessonId: "les_2",
        lessonTitle: "Lesson 2",
        modulePosition: 0,
        lessonPosition: 1,
        completed: false,
        positionSeconds: 30,
        lastSeenAt: new Date("2026-03-01T11:00:00Z"),
      },
    ];

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn().mockResolvedValue(lessonRows),
              })),
            })),
          })),
        })),
      })),
    };

    const resume = await getResumeLessonForCourse(
      "course_1",
      "user_1",
      mockDb as unknown as Parameters<typeof getResumeLessonForCourse>[2],
    );
    expect(resume.resumeLessonId).toBe("les_2");
    expect(resume.resumeHref).toBe("/courses/course_1/lessons/les_2");
  });
});

describe("checkCourseAccess", () => {
  it("returns false immediately when userId is missing or null", async () => {
    expect(await checkCourseAccess(null, "course_1", "default")).toBe(false);
    expect(await checkCourseAccess(undefined, "course_1", "default")).toBe(false);
  });
});
