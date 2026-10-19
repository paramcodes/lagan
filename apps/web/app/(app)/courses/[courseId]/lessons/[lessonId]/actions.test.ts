import type * as LaganDb from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../../../lib/rate-limit";

const authMock = vi.hoisted(() => ({
  state: { session: { user: { id: "user_1" } } as unknown },
  getSession: vi.fn(async () => authMock.state.session),
}));

const accessMock = vi.hoisted(() => ({
  hasAccess: vi.fn(async () => true),
}));

const dbMock = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn(async () => [{ id: "progress_1" }]);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  const courseRows = [
    {
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
    },
  ];
  const limit = vi.fn(async () => courseRows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { insert, select, values, onConflictDoUpdate, limit, courseRows };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("../../../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSession } },
}));

vi.mock("@lagan/db", async (importOriginal) => ({
  ...(await importOriginal<typeof LaganDb>()),
  hasAccess: accessMock.hasAccess,
}));

vi.mock("../../../../../../lib/db", () => ({
  db: {
    insert: dbMock.insert,
    select: dbMock.select,
  },
}));

import { saveLessonProgress } from "./actions";

describe("saveLessonProgress server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    authMock.state.session = { user: { id: "user_1" } };
    accessMock.hasAccess.mockResolvedValue(true);
    dbMock.courseRows.length = 0;
    dbMock.courseRows.push({
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
    });
  });

  it("throws Unauthorized when user is not authenticated", async () => {
    authMock.state.session = null;
    await expect(
      saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
        positionSeconds: 10,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects unknown fields via strict schema validation", async () => {
    await expect(
      saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
        positionSeconds: 10,
        // @ts-expect-error Testing runtime rejection of unknown field
        unexpectedField: "evil",
      }),
    ).rejects.toThrow();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects invalid types or negative seconds", async () => {
    await expect(
      saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
        positionSeconds: -5,
      }),
    ).rejects.toThrow();
  });

  it("throws Course not found when course does not exist", async () => {
    dbMock.courseRows.length = 0;
    await expect(
      saveLessonProgress({
        courseId: "course_missing",
        lessonId: "les_1",
      }),
    ).rejects.toThrow("Course not found");
  });

  it("throws Forbidden when user has no access", async () => {
    accessMock.hasAccess.mockResolvedValueOnce(false);
    await expect(
      saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("saves progress successfully when authenticated and authorized", async () => {
    const res = await saveLessonProgress({
      courseId: "course_1",
      lessonId: "les_1",
      positionSeconds: 45,
      completed: true,
    });

    expect(res).toEqual({
      success: true,
      courseId: "course_1",
      lessonId: "les_1",
      positionSeconds: 45,
      completed: true,
    });
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("rate limits rapid progress saves to 60 req/min", async () => {
    for (let i = 0; i < 60; i++) {
      await saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
        positionSeconds: i,
      });
    }

    await expect(
      saveLessonProgress({
        courseId: "course_1",
        lessonId: "les_1",
        positionSeconds: 99,
      }),
    ).rejects.toThrow("Too many requests");
  });
});
