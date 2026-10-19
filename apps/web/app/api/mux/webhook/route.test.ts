import { createHmac } from "node:crypto";
import { lessons } from "@lagan/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../lib/rate-limit";

const { updateMock, setMock, whereMock } = vi.hoisted(() => {
  const returningMock = vi.fn(async () => [{ id: "lesson_1" }]);
  const whereMock = vi.fn(() => ({ returning: returningMock }));
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  return { updateMock, setMock, whereMock, returningMock };
});

vi.mock("../../../../lib/db", () => ({ db: { update: updateMock } }));

import { POST } from "./route";

const SECRET = "webhook-signing-secret";

function webhookRequest(body: string, signature: string | null): Request {
  return {
    text: async () => body,
    headers: { get: (name: string) => (name === "mux-signature" ? signature : null) },
  } as unknown as Request;
}

function signedRequest(payload: unknown, secret: string = SECRET): Request {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return webhookRequest(body, `t=${timestamp},v1=${digest}`);
}

const assetReady = {
  type: "video.asset.ready",
  data: {
    id: "asset_1",
    passthrough: "lesson_1",
    playback_ids: [{ id: "playback_1", policy: "public" }],
  },
};

describe("POST /api/mux/webhook", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.stubEnv("MUX_WEBHOOK_SIGNING_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("stores the playback id on the lesson named by passthrough", async () => {
    const response = await POST(signedRequest(assetReady));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, updated: true });

    expect(updateMock).toHaveBeenCalledWith(lessons);
    expect(setMock).toHaveBeenCalledWith({
      muxPlaybackId: "playback_1",
      updatedAt: expect.any(Date),
    });
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a delivery signed with the wrong secret", async () => {
    const response = await POST(signedRequest(assetReady, "not-our-secret"));

    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a delivery with no signature", async () => {
    const response = await POST(webhookRequest(JSON.stringify(assetReady), null));

    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("acks other Mux events without touching the database", async () => {
    const response = await POST(
      signedRequest({
        type: "video.upload.asset_created",
        data: { id: "upload_1", passthrough: "lesson_1" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, updated: false });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("acks an asset without a passthrough but updates nothing", async () => {
    const response = await POST(
      signedRequest({
        type: "video.asset.ready",
        data: { id: "asset_2", playback_ids: [{ id: "playback_2", policy: "public" }] },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, updated: false });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses to run when the signing secret is missing", async () => {
    vi.stubEnv("MUX_WEBHOOK_SIGNING_SECRET", "");

    const response = await POST(signedRequest(assetReady));

    expect(response.status).toBe(500);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit threshold is exceeded", async () => {
    for (let i = 0; i < 100; i++) {
      const res = await POST(signedRequest(assetReady));
      expect(res.status).toBe(200);
    }

    const burstResponse = await POST(signedRequest(assetReady));
    expect(burstResponse.status).toBe(429);
    expect(burstResponse.headers.get("Retry-After")).toBeDefined();
  });
});
