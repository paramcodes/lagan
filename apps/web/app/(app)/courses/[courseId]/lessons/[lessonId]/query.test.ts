import type * as LaganDb from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.hoisted(() => ({
  hasAccess: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const state = {
    course: {
      id: "course_1",
      title: "Full-Stack Distributed Systems",
      tenantId: "default",
      authorId: "author_1",
      isFree: false,
      priceCents: 4999,
    } as Record<string, unknown>,
    modules: [
      { id: "mod_1", courseId: "course_1", title: "Module 1: Foundations", position: 0 },
      { id: "mod_2", courseId: "course_1", title: "Module 2: Advanced", position: 1 },
    ],
    lessons: [
      {
        id: "les_1",
        moduleId: "mod_1",
        type: "video",
        title: "Introduction",
        position: 0,
        status: "published",
        muxPlaybackId: "mux_123",
        contentJson: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-10-19T00:00:00Z"),
      },
      {
        id: "les_2",
        moduleId: "mod_1",
        type: "text",
        title: "Architecture Guide",
        position: 1,
        status: "published",
        muxPlaybackId: null,
        contentJson: { type: "doc" },
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-10-19T00:00:00Z"),
      },
      {
        id: "les_3",
        moduleId: "mod_2",
        type: "quiz",
        title: "Module 2 Quiz",
        position: 0,
        status: "published",
        muxPlaybackId: null,
        contentJson: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-10-19T00:00:00Z"),
      },
    ],
    progress: [
      {
        lessonId: "les_1",
        completed: true,
        positionSeconds: 240,
      },
    ],
  };

  const limitMock = vi.fn<() => Promise<Record<string, unknown>[]>>(async () => [state.course]);
  const orderByMock = vi.fn<(_clause?: unknown) => Promise<Record<string, unknown>[]>>(
    async () => [],
  );
  const whereMock = vi.fn((_cond?: unknown) => {
    const promise = Promise.resolve(state.progress);
    return Object.assign(promise, {
      limit: limitMock,
      orderBy: orderByMock,
    });
  });
  const fromMock = vi.fn(() => ({
    where: whereMock,
  }));
  const selectMock = vi.fn(() => ({
    from: fromMock,
  }));

  return {
    state,
    selectMock,
    fromMock,
    whereMock,
    orderByMock,
    limitMock,
  };
});

vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: dbMock.selectMock,
  },
}));

vi.mock("@lagan/db", async (importOriginal) => {
  const actual = await importOriginal<typeof LaganDb>();
  return {
    ...actual,
    hasAccess: accessMock.hasAccess,
  };
});

import { getLessonPlayerData } from "./query";

describe("getLessonPlayerData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.hasAccess.mockResolvedValue(true);
    dbMock.state.course = {
      id: "course_1",
      title: "Full-Stack Distributed Systems",
      tenantId: "default",
      authorId: "author_1",
      isFree: false,
      priceCents: 4999,
    };
  });

  it("returns not_found when course does not exist", async () => {
    dbMock.limitMock.mockResolvedValueOnce([]);

    const result = await getLessonPlayerData("missing_course", "les_1", "user_1");
    expect(result.status).toBe("not_found");
  });

  it("returns unauthorized when user lacks access and is not author", async () => {
    dbMock.limitMock.mockResolvedValueOnce([dbMock.state.course]);
    accessMock.hasAccess.mockResolvedValueOnce(false);

    const result = await getLessonPlayerData("course_1", "les_1", "unauthorized_user");
    expect(result.status).toBe("unauthorized");
  });

  it("returns success with modules, lessons, and sequential navigation", async () => {
    dbMock.limitMock.mockResolvedValueOnce([dbMock.state.course]);
    dbMock.orderByMock.mockResolvedValueOnce(dbMock.state.modules);
    dbMock.orderByMock.mockResolvedValueOnce(dbMock.state.lessons);

    const result = await getLessonPlayerData("course_1", "les_2", "user_1");
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.course.title).toBe("Full-Stack Distributed Systems");
    expect(result.lesson.id).toBe("les_2");
    expect(result.lesson.type).toBe("text");
    expect(result.prevLesson?.id).toBe("les_1");
    expect(result.nextLesson?.id).toBe("les_3");
    expect(result.modules).toHaveLength(2);
    expect(result.totalLessons).toBe(3);
    expect(result.completedLessonsCount).toBe(1);
  });
});
