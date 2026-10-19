import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MUX_API_BASE = "https://api.mux.com";

/** Tolerance Mux's own SDKs use when they check the signature timestamp. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export type MuxUploadRequest = {
  /** Lesson the uploaded asset belongs to. Returned to us as `passthrough`. */
  lessonId: string;
  /** Origin allowed to PUT the file straight to Mux, e.g. `https://lagan.test`. */
  corsOrigin: string;
};

export type MuxUpload = {
  /** Mux upload id, for correlating `video.upload.*` events. */
  id: string;
  /** Authenticated URL the client PUTs the file body to. */
  url: string;
};

const muxUploadResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    url: z.string().nullable(),
  }),
});

/**
 * Create a Mux direct upload for a lesson.
 *
 * The lesson id travels as the asset `passthrough`, so the webhook can find the
 * lesson row again without an extra lookup table. Assets are created public;
 * signed playback policy lands with the entitlement work.
 */
export async function createMuxUpload(request: MuxUploadRequest): Promise<MuxUpload> {
  const tokenId = requireEnv("MUX_TOKEN_ID");
  const tokenSecret = requireEnv("MUX_TOKEN_SECRET");

  const response = await fetch(`${MUX_API_BASE}/video/v1/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      cors_origin: request.corsOrigin,
      new_asset_settings: {
        playback_policies: ["public"],
        passthrough: request.lessonId,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Mux upload request failed with status ${response.status}`);
  }

  const { data } = muxUploadResponseSchema.parse(await response.json());
  if (data.url === null) {
    throw new Error("Mux upload response has no URL");
  }

  return { id: data.id, url: data.url };
}

/** The slice of a Mux webhook body this app reads. */
const muxWebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    passthrough: z.string().nullish(),
    playback_ids: z.array(z.object({ id: z.string(), policy: z.string() })).optional(),
  }),
});

export type MuxWebhookEvent = z.infer<typeof muxWebhookEventSchema>;

/** Parse a webhook body that already passed signature verification. */
export function parseMuxWebhookEvent(rawBody: string): MuxWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const parsed = muxWebhookEventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Verify a `Mux-Signature` header against the raw request body.
 *
 * Mux signs `${timestamp}.${rawBody}` with HMAC-SHA256 under the endpoint's
 * signing secret. A timestamp outside the tolerance fails the check, which caps
 * how long a captured request stays replayable.
 */
export function verifyMuxWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceMs: number = SIGNATURE_TOLERANCE_MS,
  now: number = Date.now(),
): boolean {
  if (!signatureHeader) {
    return false;
  }

  // Header shape: `t=<unix seconds>,v1=<hex digest>`. A second v1 can appear
  // while a secret is being rotated, so collect them all.
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

/** Compare hex against a digest without leaking where they first differ. */
function equalsHexDigest(hex: string, expected: Buffer): boolean {
  const actual = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requireEnv(name: "MUX_TOKEN_ID" | "MUX_TOKEN_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}
