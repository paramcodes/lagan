import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMuxUpload, parseMuxWebhookEvent, verifyMuxWebhookSignature } from "./mux";

const SECRET = "test-signing-secret";
const TIMESTAMP = 1_700_000_000;
const NOW = TIMESTAMP * 1000;

function signWith(secret: string, body: string, timestamp: number = TIMESTAMP): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("verifyMuxWebhookSignature", () => {
  const body = '{"type":"video.asset.ready"}';

  it("accepts the signature Mux would send", () => {
    expect(verifyMuxWebhookSignature(body, signWith(SECRET, body), SECRET, undefined, NOW)).toBe(
      true,
    );
  });

  it("rejects a body changed after signing", () => {
    const signature = signWith(SECRET, body);
    const tampered = '{"type":"video.asset.deleted"}';

    expect(verifyMuxWebhookSignature(tampered, signature, SECRET, undefined, NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(
      verifyMuxWebhookSignature(body, signWith("other-secret", body), SECRET, undefined, NOW),
    ).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyMuxWebhookSignature(body, null, SECRET, undefined, NOW)).toBe(false);
    expect(verifyMuxWebhookSignature(body, "v1=abc", SECRET, undefined, NOW)).toBe(false);
    expect(verifyMuxWebhookSignature(body, "t=not-a-number,v1=abc", SECRET, undefined, NOW)).toBe(
      false,
    );
  });

  it("rejects a timestamp older than the tolerance", () => {
    const signature = signWith(SECRET, body);
    const later = NOW + 5 * 60 * 1000 + 1;

    expect(verifyMuxWebhookSignature(body, signature, SECRET, undefined, later)).toBe(false);
  });

  it("accepts any of the v1 digests while a secret rotates", () => {
    const signature = `t=${TIMESTAMP},v1=${"0".repeat(64)},v1=${signWith(SECRET, body).split("v1=")[1]}`;

    expect(verifyMuxWebhookSignature(body, signature, SECRET, undefined, NOW)).toBe(true);
  });
});

describe("parseMuxWebhookEvent", () => {
  it("returns the typed event for a Mux payload", () => {
    const event = parseMuxWebhookEvent(
      JSON.stringify({
        type: "video.asset.ready",
        data: {
          id: "asset_1",
          passthrough: "lesson_1",
          playback_ids: [{ id: "playback_1", policy: "public" }],
        },
      }),
    );

    expect(event?.type).toBe("video.asset.ready");
    expect(event?.data.passthrough).toBe("lesson_1");
    expect(event?.data.playback_ids?.[0]?.id).toBe("playback_1");
  });

  it("returns null for a body that is not a Mux event", () => {
    expect(parseMuxWebhookEvent("not json")).toBeNull();
    expect(parseMuxWebhookEvent('{"type":"video.asset.ready"}')).toBeNull();
  });
});

describe("createMuxUpload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }) {
    const mock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () => response);
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("posts a direct upload and returns the id and url", async () => {
    vi.stubEnv("MUX_TOKEN_ID", "token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "token-secret");
    const fetchMock = stubFetch({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "upload_1", url: "https://upload.mux.test/upload_1" } }),
    });

    const upload = await createMuxUpload({
      lessonId: "lesson_1",
      corsOrigin: "https://lagan.test",
    });

    expect(upload).toEqual({ id: "upload_1", url: "https://upload.mux.test/upload_1" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.mux.com/video/v1/uploads");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("token-id:token-secret").toString("base64")}`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      cors_origin: "https://lagan.test",
      new_asset_settings: {
        playback_policies: ["public"],
        passthrough: "lesson_1",
      },
    });
  });

  it("throws when Mux rejects the request", async () => {
    vi.stubEnv("MUX_TOKEN_ID", "token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "token-secret");
    stubFetch({ ok: false, status: 401, json: async () => ({}) });

    await expect(
      createMuxUpload({ lessonId: "lesson_1", corsOrigin: "https://lagan.test" }),
    ).rejects.toThrow("status 401");
  });

  it("throws when the credentials are missing", async () => {
    vi.stubEnv("MUX_TOKEN_ID", "");
    vi.stubEnv("MUX_TOKEN_SECRET", "");

    await expect(
      createMuxUpload({ lessonId: "lesson_1", corsOrigin: "https://lagan.test" }),
    ).rejects.toThrow("MUX_TOKEN_ID is not set");
  });
});
