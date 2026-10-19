import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Stripe's default signature tolerance, in milliseconds. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export type StripeCheckoutSessionRequest = {
  userId: string;
  courseId: string;
  courseTitle: string;
  priceCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string;
};

const checkoutSessionResponseSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
});

export async function createStripeCheckoutSession(
  request: StripeCheckoutSessionRequest,
): Promise<StripeCheckoutSession> {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");

  const body = new URLSearchParams({
    mode: "payment",
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    client_reference_id: request.userId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": request.currency,
    "line_items[0][price_data][unit_amount]": String(request.priceCents),
    "line_items[0][price_data][product_data][name]": request.courseTitle,
    "metadata[userId]": request.userId,
    "metadata[courseId]": request.courseId,
  });

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Stripe checkout session request failed with status ${response.status}`);
  }

  const { id, url } = checkoutSessionResponseSchema.parse(await response.json());
  if (url === null) {
    throw new Error("Stripe checkout session response has no URL");
  }

  return { id, url };
}

/**
 * Amount to charge for a course: list price less its discount, rounded to the
 * nearest cent (`Math.round`, i.e. half rounds up). Callers reject a non-positive
 * result rather than opening a zero-amount paid session.
 */
export function computeChargeCents(priceCents: number, discountPercent: number): number {
  return Math.round((priceCents * (100 - discountPercent)) / 100);
}

const stripeWebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      payment_intent: z.string().nullish(),
      metadata: z.record(z.string(), z.string()).nullish(),
    }),
  }),
});

export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;

export function parseStripeWebhookEvent(rawBody: string): StripeWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const parsed = stripeWebhookEventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export type EnrollmentIntent = {
  userId: string;
  courseId: string;
  stripePaymentId: string;
};

export function enrollmentIntentFromEvent(event: StripeWebhookEvent): EnrollmentIntent | null {
  if (event.type !== "checkout.session.completed") {
    return null;
  }

  const { id, payment_intent: paymentIntent, metadata } = event.data.object;
  const userId = metadata?.userId;
  const courseId = metadata?.courseId;
  if (!userId || !courseId) {
    return null;
  }

  return { userId, courseId, stripePaymentId: paymentIntent ?? id };
}

/**
 * Verify a `Stripe-Signature` header against the raw request body.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 under the endpoint's
 * signing secret. A stale timestamp fails so a captured delivery cannot be
 * replayed past the tolerance.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceMs: number = SIGNATURE_TOLERANCE_MS,
  now: number = Date.now(),
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const parts = new Map<string, string[]>();
  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    parts.set(key, [...(parts.get(key) ?? []), part.slice(separator + 1).trim()]);
  }

  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceMs) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((signature) => equalsHexDigest(signature, expected));
}

function equalsHexDigest(hex: string, expected: Buffer): boolean {
  const actual = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requireEnv(name: "STRIPE_SECRET_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}
