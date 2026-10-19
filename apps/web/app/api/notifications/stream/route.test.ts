import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => {
  const state = { session: { user: { id: "user_1", tenantId: "default" } } as unknown };
  const getSessionMock = vi.fn(async () => state.session);
  return { state, getSessionMock };
});

const dbMock = vi.hoisted(() => {
  const state = {
    count: 2,
    items: [
      {
        id: "notif_1",
        tenantId: "default",
        userId: "user_1",
        type: "lesson_published",
        payload: { lessonTitle: "Intro" },
        readAt: null,
        createdAt: new Date("2026-10-19T05:00:00Z"),
      },
      {
        id: "notif_2",
        tenantId: "default",
        userId: "user_1",
        type: "course_published",
        payload: { courseTitle: "Rust" },
        readAt: null,
        createdAt: new Date("2026-10-19T04:00:00Z"),
      },
    ],
  };

  const limitMock = vi.fn(async () => state.items);
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn((_cond?: unknown) => {
    // If used in count query: it resolves immediately to [{ count: state.count }]
    const promise = Promise.resolve([{ count: state.count }]);
    return Object.assign(promise, {
      orderBy: orderByMock,
      limit: limitMock,
    });
  });
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  const setMock = vi.fn(() => ({ where: vi.fn(async () => [{ success: true }]) }));
  const updateMock = vi.fn(() => ({ set: setMock }));

  return { state, selectMock, fromMock, whereMock, orderByMock, limitMock, updateMock };
});

vi.mock("../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSessionMock } },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: dbMock.selectMock,
    update: dbMock.updateMock,
  },
}));

import { notificationBus } from "../../../../lib/notifications";
import { GET } from "./route";

function makeRequest(headers: Record<string, string> = {}, signal?: AbortSignal): Request {
  const init: RequestInit = { headers };
  if (signal) {
    init.signal = signal;
  }
  return new Request("https://lagan.test/api/notifications/stream", init);
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value, done } = await reader.read();
  if (done || !value) return "";
  return new TextDecoder().decode(value);
}
function getStreamReader(response: Response): ReadableStreamDefaultReader<Uint8Array> {
  if (!response.body) {
    throw new Error("Response body is null");
  }
  return response.body.getReader();
}

describe("GET /api/notifications/stream", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATIONS_PING_INTERVAL_MS", "100");
    notificationBus.clear();
    authMock.state.session = { user: { id: "user_1", tenantId: "default" } };
  });

  afterEach(() => {
    notificationBus.clear();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 if session is unauthenticated", async () => {
    authMock.state.session = null;

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("sets required SSE headers on success", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    if (response.body) {
      await response.body.cancel();
    }
  });

  it("streams the initial sync frame upon connection", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(response.body).not.toBeNull();

    const reader = getStreamReader(response);
    const chunk = await readChunk(reader);
    await reader.cancel();

    expect(chunk).toContain("event: sync");
    expect(chunk).toContain('"unreadCount":2');
    expect(chunk).toContain('"id":"notif_1"');
    expect(chunk).toContain('"id":"notif_2"');
  });

  it("streams real-time notification frames to matching user", async () => {
    const response = await GET(makeRequest());
    const reader = getStreamReader(response);

    // Consume sync frame
    const syncChunk = await readChunk(reader);
    expect(syncChunk).toContain("event: sync");

    // Publish notification to user_1
    const newNotif = {
      id: "notif_3",
      tenantId: "default",
      userId: "user_1",
      type: "announcement_posted",
      payload: { message: "Welcome to class!" },
      readAt: null,
      createdAt: new Date("2026-10-19T06:00:00Z"),
    };
    notificationBus.publish(newNotif);

    const notifChunk = await readChunk(reader);
    await reader.cancel();

    expect(notifChunk).toContain("event: notification");
    expect(notifChunk).toContain("id: notif_3");
    expect(notifChunk).toContain('"type":"announcement_posted"');
  });

  it("does not deliver notifications across different users", async () => {
    const response = await GET(makeRequest());
    const reader = getStreamReader(response);

    // Consume sync frame
    await readChunk(reader);

    // Publish to user_other
    notificationBus.publish({
      id: "notif_other",
      tenantId: "default",
      userId: "user_other",
      type: "course_published",
      payload: {},
      readAt: null,
      createdAt: new Date(),
    });

    // Publish to user_1
    notificationBus.publish({
      id: "notif_user1",
      tenantId: "default",
      userId: "user_1",
      type: "course_published",
      payload: {},
      readAt: null,
      createdAt: new Date(),
    });

    const chunk = await readChunk(reader);
    await reader.cancel();

    expect(chunk).not.toContain("notif_other");
    expect(chunk).toContain("notif_user1");
  });

  it("sends periodic ping comment and heartbeat frames", async () => {
    vi.useFakeTimers();
    const response = await GET(makeRequest());
    const reader = getStreamReader(response);

    // 1. sync chunk
    await readChunk(reader);

    // 2. Advance fake clock past ping interval
    vi.advanceTimersByTime(150);

    const pingChunk = await readChunk(reader);
    await reader.cancel();

    expect(pingChunk).toContain(": ping");
    expect(pingChunk).toContain("event: ping");
    expect(pingChunk).toContain('"timestamp":');
  });

  it("cleans up listeners and timers cleanly on client abort", async () => {
    const controller = new AbortController();
    const response = await GET(makeRequest({}, controller.signal));
    expect(notificationBus.activeConnectionsCount("user_1")).toBe(1);

    // Abort connection
    controller.abort();

    expect(notificationBus.activeConnectionsCount("user_1")).toBe(0);
    if (response.body) {
      await response.body.cancel();
    }
  });
  it("enforces connection concurrency cap of 3 per user", async () => {
    const res1 = await GET(makeRequest());
    const res2 = await GET(makeRequest());
    const res3 = await GET(makeRequest());

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    const res4 = await GET(makeRequest());
    expect(res4.status).toBe(429);
    const body4 = await res4.json();
    expect(body4.error).toBe("too_many_connections");

    // Close one connection
    await res1.body?.cancel();
    await Promise.resolve();
    // Now another connection is accepted
    const res5 = await GET(makeRequest());
    expect(res5.status).toBe(200);

    await res2.body?.cancel();
    await res3.body?.cancel();
    await res5.body?.cancel();
  });
});
