import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeChargeCents,
  createStripeCheckoutSession,
  enrollmentIntentFromEvent,
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./stripe";

const SECRET = "whsec_test_secret";
const TIMESTAMP = 1_700_000_000;
const NOW = TIMESTAMP * 1000;

function signWith(secret: string, body: string, timestamp: number = TIMESTAMP): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyStripeWebhookSignature", () => {
  const body = '{"type":"checkout.session.completed"}';

  it("accepts the signature Stripe would send", () => {
    expect(verifyStripeWebhookSignature(body, signWith(SECRET, body), SECRET, undefined, NOW)).toBe(
      true,
    );
  });

  it("rejects a body changed after signing", () => {
    const signature = signWith(SECRET, body);
    const tampered = '{"type":"checkout.session.expired"}';

    expect(verifyStripeWebhookSignature(tampered, signature, SECRET, undefined, NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(
      verifyStripeWebhookSignature(body, signWith("other", body), SECRET, undefined, NOW),
    ).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyStripeWebhookSignature(body, null, SECRET, undefined, NOW)).toBe(false);
    expect(verifyStripeWebhookSignature(body, "v1=abc", SECRET, undefined, NOW)).toBe(false);
    expect(verifyStripeWebhookSignature(body, "t=nan,v1=abc", SECRET, undefined, NOW)).toBe(false);
  });

  it("rejects a timestamp outside the tolerance", () => {
    const signature = signWith(SECRET, body);

    expect(
      verifyStripeWebhookSignature(body, signature, SECRET, undefined, NOW + 5 * 60 * 1000 + 1),
    ).toBe(false);
  });

  it("accepts any v1 digest while a secret rotates", () => {
    const valid = signWith(SECRET, body).split("v1=")[1];
    const signature = `t=${TIMESTAMP},v1=${"0".repeat(64)},v1=${valid}`;

    expect(verifyStripeWebhookSignature(body, signature, SECRET, undefined, NOW)).toBe(true);
  });
});

describe("computeChargeCents", () => {
  it("subtracts the discount and rounds half up to the nearest cent", () => {
    expect(computeChargeCents(10000, 50)).toBe(5000);
    expect(computeChargeCents(9999, 33)).toBe(6699);
    expect(computeChargeCents(10000, 0)).toBe(10000);
    expect(computeChargeCents(10000, 100)).toBe(0);
  });
});

describe("parseStripeWebhookEvent", () => {
  it("returns the typed event for a Stripe payload", () => {
    const event = parseStripeWebhookEvent(
      JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: { id: "cs_1", payment_intent: "pi_1", metadata: { userId: "u1" } },
        },
      }),
    );

    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.data.object.payment_intent).toBe("pi_1");
  });

  it("returns null for a body that is not JSON or has the wrong shape", () => {
    expect(parseStripeWebhookEvent("not json")).toBeNull();
    expect(parseStripeWebhookEvent(JSON.stringify({ type: "x" }))).toBeNull();
  });
});

describe("enrollmentIntentFromEvent", () => {
  function event(overrides: Record<string, unknown> = {}) {
    return {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_1",
          metadata: { userId: "user_1", courseId: "course_1" },
          ...overrides,
        },
      },
    };
  }

  it("builds an intent from the session metadata and payment intent", () => {
    expect(enrollmentIntentFromEvent(event())).toEqual({
      userId: "user_1",
      courseId: "course_1",
      stripePaymentId: "pi_1",
    });
  });

  it("falls back to the session id when there is no payment intent", () => {
    expect(enrollmentIntentFromEvent(event({ payment_intent: null }))?.stripePaymentId).toBe(
      "cs_1",
    );
  });

  it("ignores other event types and incomplete metadata", () => {
    expect(enrollmentIntentFromEvent({ ...event(), type: "checkout.session.expired" })).toBeNull();
    expect(enrollmentIntentFromEvent(event({ metadata: { userId: "user_1" } }))).toBeNull();
    expect(enrollmentIntentFromEvent(event({ metadata: null }))).toBeNull();
  });
});

describe("createStripeCheckoutSession", () => {
  const request = {
    userId: "user_1",
    courseId: "course_1",
    courseTitle: "Intro to Rust",
    priceCents: 4900,
    currency: "usd",
    successUrl: "https://lagan.test/courses/course_1?checkout=success",
    cancelUrl: "https://lagan.test/courses/course_1?checkout=cancelled",
  };

  function mockFetch(response: unknown, ok = true, status = 200) {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok,
      status,
      json: async () => response,
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("creates a payment-mode session and returns its URL", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    const fetchMock = mockFetch({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });

    await expect(createStripeCheckoutSession(request)).resolves.toEqual({
      id: "cs_1",
      url: "https://checkout.stripe.com/cs_1",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk_test_key" });

    const body = new URLSearchParams(init.body as string);
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("4900");
    expect(body.get("line_items[0][price_data][product_data][name]")).toBe("Intro to Rust");
    expect(body.get("metadata[userId]")).toBe("user_1");
    expect(body.get("metadata[courseId]")).toBe("course_1");
  });

  it("throws when Stripe rejects the request", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    mockFetch({ error: { message: "bad" } }, false, 402);

    await expect(createStripeCheckoutSession(request)).rejects.toThrow("status 402");
  });

  it("throws when the response carries no URL", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    mockFetch({ id: "cs_1", url: null });

    await expect(createStripeCheckoutSession(request)).rejects.toThrow("no URL");
  });

  it("throws when the secret key is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    mockFetch({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });

    await expect(createStripeCheckoutSession(request)).rejects.toThrow("STRIPE_SECRET_KEY");
  });
});
