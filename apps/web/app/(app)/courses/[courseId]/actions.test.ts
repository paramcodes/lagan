import type * as LaganDb from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../lib/rate-limit";
import { enrollFreeCourse } from "./actions";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const dbPackageMock = vi.hoisted(() => ({
  enrollLearner: vi.fn(),
}));

const cacheMock = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSession } },
}));

vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMock.revalidatePath,
}));

vi.mock("@lagan/db", async (importOriginal) => {
  const actual = await importOriginal<typeof LaganDb>();
  return {
    ...actual,
    enrollLearner: dbPackageMock.enrollLearner,
  };
});

describe("enrollFreeCourse server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
  });

  it("rejects anonymous callers with Unauthorized", async () => {
    authMock.getSession.mockResolvedValue(null);

    await expect(enrollFreeCourse("course_free")).rejects.toThrow("Unauthorized");
    expect(dbPackageMock.enrollLearner).not.toHaveBeenCalled();
  });

  it("rejects when course does not exist or is not published", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_123" } });
    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    await expect(enrollFreeCourse("course_missing")).rejects.toThrow(
      "Course not found or unavailable",
    );
    expect(dbPackageMock.enrollLearner).not.toHaveBeenCalled();
  });

  it("rejects when course is paid and requires checkout", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_123" } });
    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "course_paid",
              tenantId: "default",
              status: "published",
              priceCents: 4999,
              isFree: false,
            },
          ]),
        })),
      })),
    });

    await expect(enrollFreeCourse("course_paid")).rejects.toThrow(
      "Cannot enroll for free: course requires payment",
    );
    expect(dbPackageMock.enrollLearner).not.toHaveBeenCalled();
  });

  it("successfully enrolls user into free course and revalidates paths", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_123" } });
    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "course_free",
              tenantId: "default",
              status: "published",
              priceCents: 0,
              isFree: true,
            },
          ]),
        })),
      })),
    });

    dbPackageMock.enrollLearner.mockResolvedValue({
      id: "enrollment_1",
      userId: "user_123",
      courseId: "course_free",
      isNew: true,
    });

    const result = await enrollFreeCourse("course_free");
    expect(result).toEqual({ success: true });

    expect(dbPackageMock.enrollLearner).toHaveBeenCalledWith({
      db: dbMock,
      userId: "user_123",
      courseId: "course_free",
      tenantId: "default",
    });

    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/courses/course_free");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/learn");
  });

  it("rejects unknown fields in input payload", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_123" } });
    await expect(
      // @ts-expect-error Testing unknown fields rejection
      enrollFreeCourse({ courseId: "course_free", invalidField: "hack" }),
    ).rejects.toThrow();
    expect(dbPackageMock.enrollLearner).not.toHaveBeenCalled();
  });

  it("rate limits rapid free enrollments to 10 req/min per user", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_123" } });
    dbMock.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "course_free",
              tenantId: "default",
              status: "published",
              priceCents: 0,
              isFree: true,
            },
          ]),
        })),
      })),
    });

    for (let i = 0; i < 10; i++) {
      const res = await enrollFreeCourse("course_free");
      expect(res).toEqual({ success: true });
    }

    // 11th request triggers rate limit
    await expect(enrollFreeCourse("course_free")).rejects.toThrow("Too many requests");
  });
});
