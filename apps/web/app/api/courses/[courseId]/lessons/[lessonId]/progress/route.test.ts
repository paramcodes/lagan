import type * as LaganDb from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../../../../lib/rate-limit";

const authMock = vi.hoisted(() => {
  const state = { session: { user: { id: "user_1" } } as unknown };
  const getSessionMock = vi.fn(async () => state.session);
  return { state, getSessionMock };
});

const accessMock = vi.hoisted(() => {
  const hasAccessMock = vi.fn(async () => true);
  return { hasAccessMock };
});

const dbMock = vi.hoisted(() => {
  const state = {
    course: {
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
      isFree: false,
      priceCents: 2000,
    } as Record<string, unknown> | null,
    progress: {
      positionSeconds: 45,
      completed: true,
    } as unknown,
  };

  const limitSelectMock = vi.fn<() => Promise<Record<string, unknown>[]>>(async () =>
    state.course ? [state.course] : [],
  );
  const whereSelectMock = vi.fn(() => ({ limit: limitSelectMock }));
  const fromSelectMock = vi.fn(() => ({ where: whereSelectMock }));
  const selectMock = vi.fn(() => ({ from: fromSelectMock }));

  const onConflictDoUpdateMock = vi.fn(async () => [{ success: true }]);
  const valuesMock = vi.fn(() => ({ onConflictDoUpdate: onConflictDoUpdateMock }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));

  return {
    state,
    selectMock,
    limitSelectMock,
    insertMock,
    valuesMock,
    onConflictDoUpdateMock,
  };
});

vi.mock("../../../../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSessionMock } },
}));

vi.mock("../../../../../../../lib/db", () => ({
  db: {
    select: dbMock.selectMock,
    insert: dbMock.insertMock,
  },
}));

vi.mock("@lagan/db", async (importOriginal) => {
  const actual = await importOriginal<typeof LaganDb>();
  return {
    ...actual,
    hasAccess: accessMock.hasAccessMock,
  };
});

import { GET, POST } from "./route";

describe("POST /api/courses/[courseId]/lessons/[lessonId]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    authMock.state.session = { user: { id: "user_1" } };
    accessMock.hasAccessMock.mockResolvedValue(true);
    dbMock.state.course = {
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
      isFree: false,
      priceCents: 2000,
    };
    dbMock.state.progress = {
      positionSeconds: 45,
      completed: true,
    };
  });

  it("returns 401 when user is not authenticated", async () => {
    authMock.state.session = null;
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when course is not found", async () => {
    dbMock.limitSelectMock.mockResolvedValueOnce([]);
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "POST",
      body: JSON.stringify({ positionSeconds: 10 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Course not found");
  });

  it("returns 403 when user is not author and hasAccess returns false", async () => {
    accessMock.hasAccessMock.mockResolvedValueOnce(false);
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "POST",
      body: JSON.stringify({ positionSeconds: 10 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Forbidden");
  });

  it("successfully records progress and completion", async () => {
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "POST",
      body: JSON.stringify({ positionSeconds: 120, completed: true }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      lessonId: "lesson_1",
      courseId: "course_1",
      positionSeconds: 120,
      completed: true,
    });
    expect(dbMock.insertMock).toHaveBeenCalled();
  });

  it("returns 400 when unknown fields are provided in payload", async () => {
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "POST",
      body: JSON.stringify({ positionSeconds: 120, completed: true, maliciousField: "injected" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid payload");
    expect(dbMock.insertMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit threshold is exceeded", async () => {
    for (let i = 0; i < 60; i++) {
      const req = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
        method: "POST",
        body: JSON.stringify({ positionSeconds: 10 }),
      });
      const res = await POST(req, {
        params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
      });
      expect(res.status).toBe(200);
    }

    const burstReq = new Request(
      "http://localhost/api/courses/course_1/lessons/lesson_1/progress",
      {
        method: "POST",
        body: JSON.stringify({ positionSeconds: 10 }),
      },
    );
    const burstRes = await POST(burstReq, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(burstRes.status).toBe(429);
    expect(burstRes.headers.get("Retry-After")).toBeDefined();
  });
});

describe("GET /api/courses/[courseId]/lessons/[lessonId]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.state.session = { user: { id: "user_1" } };
    accessMock.hasAccessMock.mockResolvedValue(true);
    dbMock.state.course = {
      id: "course_1",
      tenantId: "default",
      authorId: "author_1",
      isFree: false,
      priceCents: 2000,
    };
    dbMock.limitSelectMock.mockResolvedValueOnce([dbMock.state.course]);
    dbMock.limitSelectMock.mockResolvedValueOnce([
      {
        positionSeconds: 50,
        completed: false,
      },
    ]);
  });

  it("returns progress for authorized learner", async () => {
    const request = new Request("http://localhost/api/courses/course_1/lessons/lesson_1/progress", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ courseId: "course_1", lessonId: "lesson_1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      courseId: "course_1",
      lessonId: "lesson_1",
      positionSeconds: 50,
      completed: false,
    });
  });
});
