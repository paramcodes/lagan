import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const state = { rows: [] as unknown[] };
  const limitMock = vi.fn(async () => state.rows);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { state, selectMock, fromMock, whereMock, limitMock };
});

const authMock = vi.hoisted(() => {
  const state = { session: { user: { id: "user_1" } } as unknown };
  const getSessionMock = vi.fn(async () => state.session);
  return { state, getSessionMock };
});

const stripeMock = vi.hoisted(() => ({
  createCheckoutMock: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({ db: { select: dbMock.selectMock } }));
vi.mock("../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSessionMock } },
}));
vi.mock("../../../../lib/stripe", () => ({
  createStripeCheckoutSession: stripeMock.createCheckoutMock,
}));

import { POST } from "./route";

const course = {
  id: "course_1",
  title: "Intro to Rust",
  priceCents: 4900,
  isFree: false,
};

function request(body: unknown): Request {
  return new Request("https://lagan.test/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    dbMock.state.rows = [course];
    authMock.state.session = { user: { id: "user_1" } };
    stripeMock.createCheckoutMock.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/cs_1",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates a checkout session for the signed-in buyer", async () => {
    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/cs_1" });

    expect(stripeMock.createCheckoutMock).toHaveBeenCalledWith({
      userId: "user_1",
      courseId: "course_1",
      courseTitle: "Intro to Rust",
      priceCents: 4900,
      currency: "usd",
      successUrl: "https://lagan.test/courses/course_1?checkout=success",
      cancelUrl: "https://lagan.test/courses/course_1?checkout=cancelled",
    });
  });

  it("prefers the configured app URL for redirects", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lagan.app");

    await POST(request({ courseId: "course_1" }));

    expect(stripeMock.createCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://lagan.app/courses/course_1?checkout=success",
      }),
    );
  });

  it("rejects an anonymous caller", async () => {
    authMock.state.session = null;

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(401);
    expect(stripeMock.createCheckoutMock).not.toHaveBeenCalled();
  });

  it("rejects a request without a course id", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(stripeMock.createCheckoutMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown course", async () => {
    dbMock.state.rows = [];

    const response = await POST(request({ courseId: "missing" }));

    expect(response.status).toBe(404);
    expect(stripeMock.createCheckoutMock).not.toHaveBeenCalled();
  });

  it("does not open checkout for a free course", async () => {
    dbMock.state.rows = [{ ...course, isFree: true, priceCents: 0 }];

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(400);
    expect(stripeMock.createCheckoutMock).not.toHaveBeenCalled();
  });
});
