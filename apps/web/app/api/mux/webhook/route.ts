import { lessons } from "@lagan/db";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { parseMuxWebhookEvent, verifyMuxWebhookSignature } from "../../../../lib/mux";
import { checkRateLimit, getClientIp, rateLimitResponse } from "../../../../lib/rate-limit";

/**
 * Mux webhook receiver.
 *
 * Mux retries any non-2xx response, so every recognised event answers 2xx even
 * when there is nothing to update. Only an unverifiable delivery is rejected.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`mux-webhook:${ip}`, 100, 60);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetSeconds);
  }

  const secret = process.env.MUX_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return Response.json({ error: "MUX_WEBHOOK_SIGNING_SECRET is not set" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifyMuxWebhookSignature(rawBody, request.headers.get("mux-signature"), secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = parseMuxWebhookEvent(rawBody);
  if (!event) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const lessonId = event.data.passthrough;
  const playbackId = event.data.playback_ids?.[0]?.id;
  if (event.type !== "video.asset.ready" || !lessonId || !playbackId) {
    return Response.json({ received: true, updated: false });
  }

  const updated = await db
    .update(lessons)
    .set({ muxPlaybackId: playbackId, updatedAt: new Date() })
    .where(eq(lessons.id, lessonId))
    .returning({ id: lessons.id });

  return Response.json({ received: true, updated: updated.length > 0 });
}
