import { describe, expect, it, vi } from "vitest";
import { listEnrolledCourses, resolveResumeLesson } from "./query";

describe("resolveResumeLesson unit tests", () => {
  const COURSE_ID = "crs_123";

  it("links to course details when there are no published lessons", () => {
    const res = resolveResumeLesson(COURSE_ID, []);
    expect(res).toEqual({
      resumeLessonId: null,
      resumeHref: `/courses/${COURSE_ID}`,
      resumeLessonTitle: null,
      actionLabel: "View Course",
    });
  });

  it("links to the first lesson with Review Course when all lessons are completed", () => {
    const res = resolveResumeLesson(COURSE_ID, [
      {
        lessonId: "les_1",
        lessonTitle: "Intro",
        completed: true,
        positionSeconds: 120,
        lastSeenAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        lessonId: "les_2",
        lessonTitle: "Deep Dive",
        completed: true,
        positionSeconds: 300,
        lastSeenAt: new Date("2026-03-02T10:00:00Z"),
      },
    ]);

    expect(res).toEqual({
      resumeLessonId: "les_1",
      resumeHref: `/courses/${COURSE_ID}/lessons/les_1`,
      resumeLessonTitle: "Intro",
      actionLabel: "Review Course",
    });
  });

  it("links to the first lesson in course order when no progress has been made (0%)", () => {
    const res = resolveResumeLesson(COURSE_ID, [
      {
        lessonId: "les_1",
        lessonTitle: "Module 1 Lesson 1",
        completed: false,
        positionSeconds: 0,
        lastSeenAt: null,
      },
      {
        lessonId: "les_2",
        lessonTitle: "Module 1 Lesson 2",
        completed: false,
        positionSeconds: 0,
        lastSeenAt: null,
      },
    ]);

    expect(res).toEqual({
      resumeLessonId: "les_1",
      resumeHref: `/courses/${COURSE_ID}/lessons/les_1`,
      resumeLessonTitle: "Module 1 Lesson 1",
      actionLabel: "Continue Learning",
    });
  });

  it("links to the next incomplete lesson in sequence after completed lessons", () => {
    const res = resolveResumeLesson(COURSE_ID, [
      {
        lessonId: "les_1",
        lessonTitle: "Lesson 1",
        completed: true,
        positionSeconds: 200,
        lastSeenAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        lessonId: "les_2",
        lessonTitle: "Lesson 2",
        completed: true,
        positionSeconds: 180,
        lastSeenAt: new Date("2026-03-02T10:00:00Z"),
      },
      {
        lessonId: "les_3",
        lessonTitle: "Lesson 3",
        completed: false,
        positionSeconds: 0,
        lastSeenAt: null,
      },
    ]);

    expect(res).toEqual({
      resumeLessonId: "les_3",
      resumeHref: `/courses/${COURSE_ID}/lessons/les_3`,
      resumeLessonTitle: "Lesson 3",
      actionLabel: "Continue Learning",
    });
  });

  it("resumes at the incomplete lesson with recent playback activity", () => {
    const res = resolveResumeLesson(COURSE_ID, [
      {
        lessonId: "les_1",
        lessonTitle: "Lesson 1",
        completed: true,
        positionSeconds: 200,
        lastSeenAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        lessonId: "les_2",
        lessonTitle: "Lesson 2",
        completed: false,
        positionSeconds: 45,
        lastSeenAt: new Date("2026-03-03T12:00:00Z"),
      },
      {
        lessonId: "les_3",
        lessonTitle: "Lesson 3",
        completed: false,
        positionSeconds: 0,
        lastSeenAt: null,
      },
    ]);

    expect(res).toEqual({
      resumeLessonId: "les_2",
      resumeHref: `/courses/${COURSE_ID}/lessons/les_2`,
      resumeLessonTitle: "Lesson 2",
      actionLabel: "Continue Learning",
    });
  });

  it("picks the most recently seen incomplete lesson if multiple have activity", () => {
    const res = resolveResumeLesson(COURSE_ID, [
      {
        lessonId: "les_1",
        lessonTitle: "Lesson 1",
        completed: false,
        positionSeconds: 30,
        lastSeenAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        lessonId: "les_2",
        lessonTitle: "Lesson 2",
        completed: false,
        positionSeconds: 120,
        lastSeenAt: new Date("2026-03-05T15:30:00Z"),
      },
      {
        lessonId: "les_3",
        lessonTitle: "Lesson 3",
        completed: false,
        positionSeconds: 10,
        lastSeenAt: new Date("2026-03-02T10:00:00Z"),
      },
    ]);

    expect(res).toEqual({
      resumeLessonId: "les_2",
      resumeHref: `/courses/${COURSE_ID}/lessons/les_2`,
      resumeLessonTitle: "Lesson 2",
      actionLabel: "Continue Learning",
    });
  });
});

describe("listEnrolledCourses integration logic with mock database", () => {
  it("returns an empty array when userId is empty", async () => {
    const result = await listEnrolledCourses("");
    expect(result).toEqual([]);
  });

  it("returns an empty array when user is not enrolled in any courses", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
        })),
      })),
    };

    const result = await listEnrolledCourses("usr_empty", mockDb as never);
    expect(result).toEqual([]);
  });

  it("retrieves enrolled courses and aggregates progress summary and resume positions", async () => {
    const enrolledRows = [
      {
        id: "course_distributed",
        title: "Distributed Systems",
        description: "Consensus and replication",
        tenantId: "default",
        status: "published",
        enrolledAt: new Date("2026-03-01T10:00:00Z"),
        authorName: "Dr. Evelyn Reed",
      },
    ];

    const lessonRows = [
      {
        courseId: "course_distributed",
        lessonId: "les_1",
        lessonTitle: "Raft Consensus",
        modulePosition: 0,
        lessonPosition: 0,
        completed: true,
        positionSeconds: 300,
        lastSeenAt: new Date("2026-03-02T10:00:00Z"),
      },
      {
        courseId: "course_distributed",
        lessonId: "les_2",
        lessonTitle: "Paxos & Two-Phase Commit",
        modulePosition: 0,
        lessonPosition: 1,
        completed: false,
        positionSeconds: 65,
        lastSeenAt: new Date("2026-03-03T11:00:00Z"),
      },
    ];

    let queryCount = 0;
    const mockDb = {
      select: vi.fn(() => {
        queryCount++;
        if (queryCount === 1) {
          // enrolledRows query
          return {
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn().mockResolvedValue(enrolledRows),
                  })),
                })),
              })),
            })),
          };
        }
        if (queryCount === 2) {
          // validTenantCourses query
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ id: "course_distributed" }]),
            })),
          };
        }
        if (queryCount === 3) {
          // getUserCoursesProgress total lessons query
          return {
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  groupBy: vi.fn().mockResolvedValue([
                    { courseId: "course_distributed", total: 2 },
                  ]),
                })),
              })),
            })),
          };
        }
        if (queryCount === 4) {
          // getUserCoursesProgress completed lessons query
          return {
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  groupBy: vi.fn().mockResolvedValue([
                    { courseId: "course_distributed", completed: 1 },
                  ]),
                })),
              })),
            })),
          };
        }
        // lessonRows query
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn().mockResolvedValue(lessonRows),
                })),
              })),
            })),
          })),
        };
      }),
    };

    const courses = await listEnrolledCourses("usr_alice", mockDb as never);

    expect(courses).toHaveLength(1);
    const item = courses[0];
    if (!item) throw new Error("Expected course item to be defined");
    expect(item.id).toBe("course_distributed");
    expect(item.title).toBe("Distributed Systems");
    expect(item.authorName).toBe("Dr. Evelyn Reed");
    expect(item.progress.completedLessons).toBe(1);
    expect(item.progress.totalLessons).toBe(2);
    expect(item.progress.percent).toBe(50);
    expect(item.progress.formatted).toBe("1 of 2 lessons");
    expect(item.progress.isCompleted).toBe(false);
    expect(item.resumeHref).toBe("/courses/course_distributed/lessons/les_2");
    expect(item.resumeLessonTitle).toBe("Paxos & Two-Phase Commit");
    expect(item.actionLabel).toBe("Continue Learning");
  });
});
