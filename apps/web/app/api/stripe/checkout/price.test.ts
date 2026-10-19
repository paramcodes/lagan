import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const state = { rows: [] as unknown[] };
  const limitMock = vi.fn(async () => state.rows);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { state, selectMock };
});

const authMock = vi.hoisted(() => {
  const getSessionMock = vi.fn(async () => ({ user: { id: "user_1" } }));
  return { getSessionMock };
});

vi.mock("../../../../lib/db", () => ({ db: { select: dbMock.selectMock } }));
vi.mock("../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSessionMock } },
}));
// `../../../../lib/stripe` is deliberately left real: these assertions read the
// exact request body `createStripeCheckoutSession` would POST to Stripe.

import { POST } from "./route";

const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";

const course = {
  id: "course_1",
  title: "Intro to Rust",
  priceCents: 10000,
  discountPercent: 0,
  isFree: false,
};

function request(body: unknown): Request {
  return new Request("https://lagan.test/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockStripeFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The `unit_amount` field Stripe would receive, read from the real request body. */
function sentUnitAmount(fetchMock: ReturnType<typeof vi.fn>): string | null {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined;
  if (!call) {
    return null;
  }
  const [url, init] = call;
  expect(url).toBe(STRIPE_CHECKOUT_URL);
  return new URLSearchParams(init.body as string).get("line_items[0][price_data][unit_amount]");
}

describe("POST /api/stripe/checkout — charged unit_amount", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    dbMock.state.rows = [course];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("charges 10000c at 50% off as 5000", async () => {
    dbMock.state.rows = [{ ...course, priceCents: 10000, discountPercent: 50 }];
    const fetchMock = mockStripeFetch();

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(200);
    expect(sentUnitAmount(fetchMock)).toBe("5000");
  });

  it("charges 9999c at 33% off as 6699 (Math.round, half up)", async () => {
    // 9999 * (100 - 33) / 100 = 6699.33 -> 6699 with Math.round.
    dbMock.state.rows = [{ ...course, priceCents: 9999, discountPercent: 33 }];
    const fetchMock = mockStripeFetch();

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(200);
    expect(sentUnitAmount(fetchMock)).toBe("6699");
  });

  it("charges 10000c at 0% off as the unchanged list price 10000", async () => {
    dbMock.state.rows = [{ ...course, priceCents: 10000, discountPercent: 0 }];
    const fetchMock = mockStripeFetch();

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(200);
    expect(sentUnitAmount(fetchMock)).toBe("10000");
  });

  it("rejects 10000c at 100% off instead of opening a zero-amount session", async () => {
    dbMock.state.rows = [{ ...course, priceCents: 10000, discountPercent: 100 }];
    const fetchMock = mockStripeFetch();

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a free course without building a session", async () => {
    dbMock.state.rows = [{ ...course, priceCents: 0, discountPercent: 0, isFree: true }];
    const fetchMock = mockStripeFetch();

    const response = await POST(request({ courseId: "course_1" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
