import { createHmac } from "node:crypto";
import { enrollments } from "@lagan/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, valuesMock, onConflictMock, returningMock } = vi.hoisted(() => {
  const returningMock = vi.fn(async () => [{ id: "enrollment_1" }]);
  const onConflictMock = vi.fn(() => ({ returning: returningMock }));
  const valuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictMock }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  return { insertMock, valuesMock, onConflictMock, returningMock };
});

vi.mock("../../../../lib/db", () => ({ db: { insert: insertMock } }));

import { POST } from "./route";

const SECRET = "whsec_test_secret";

function webhookRequest(body: string, signature: string | null): Request {
  return {
    text: async () => body,
    headers: { get: (name: string) => (name === "stripe-signature" ? signature : null) },
  } as unknown as Request;
}

function signedRequest(payload: unknown, secret: string = SECRET): Request {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return webhookRequest(body, `t=${timestamp},v1=${digest}`);
}

const checkoutCompleted = {
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_intent: "pi_1",
      metadata: { userId: "user_1", courseId: "course_1" },
    },
  },
};

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SIGNING_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("enrolls the buyer from a completed checkout session", async () => {
    const response = await POST(signedRequest(checkoutCompleted));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, enrolled: true });

    expect(insertMock).toHaveBeenCalledWith(enrollments);
    expect(valuesMock).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "user_1",
      courseId: "course_1",
      stripePaymentId: "pi_1",
    });
    expect(onConflictMock).toHaveBeenCalledTimes(1);
  });

  it("treats a replayed delivery as already enrolled", async () => {
    returningMock.mockResolvedValueOnce([]);

    const response = await POST(signedRequest(checkoutCompleted));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, enrolled: false });
  });

  it("rejects a delivery signed with the wrong secret", async () => {
    const response = await POST(signedRequest(checkoutCompleted, "not-our-secret"));

    expect(response.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a delivery with no signature", async () => {
    const response = await POST(webhookRequest(JSON.stringify(checkoutCompleted), null));

    expect(response.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a signed body that is not a Stripe event", async () => {
    const response = await POST(signedRequest({ hello: "world" }));

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("acks other Stripe events without enrolling anyone", async () => {
    const response = await POST(
      signedRequest({
        type: "checkout.session.expired",
        data: { object: { id: "cs_2", metadata: { userId: "user_1", courseId: "course_1" } } },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, enrolled: false });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("refuses to run when the signing secret is missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SIGNING_SECRET", "");

    const response = await POST(signedRequest(checkoutCompleted));

    expect(response.status).toBe(500);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
