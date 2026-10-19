import { enrollments } from "@lagan/db";
import { db } from "../../../../lib/db";
import {
  enrollmentIntentFromEvent,
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "../../../../lib/stripe";

/**
 * Stripe webhook receiver.
 *
 * Stripe retries any non-2xx response, so recognised events answer 2xx even when
 * there is nothing to insert. Only an unverifiable delivery is rejected.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return Response.json({ error: "STRIPE_WEBHOOK_SIGNING_SECRET is not set" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = parseStripeWebhookEvent(rawBody);
  if (!event) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const intent = enrollmentIntentFromEvent(event);
  if (!intent) {
    return Response.json({ received: true, enrolled: false });
  }

  const inserted = await db
    .insert(enrollments)
    .values({
      id: crypto.randomUUID(),
      userId: intent.userId,
      courseId: intent.courseId,
      stripePaymentId: intent.stripePaymentId,
    })
    .onConflictDoNothing()
    .returning({ id: enrollments.id });

  return Response.json({ received: true, enrolled: inserted.length > 0 });
}
