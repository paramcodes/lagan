import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../lib/rate-limit";

const authMock = vi.hoisted(() => {
  const state = { session: { user: { id: "user_1", tenantId: "default" } } as unknown };
  const getSessionMock = vi.fn(async () => state.session);
  return { state, getSessionMock };
});

const dbMock = vi.hoisted(() => {
  const state = {
    count: 3,
    items: [
      {
        id: "notif_1",
        tenantId: "default",
        userId: "user_1",
        type: "lesson_published",
        payload: {},
        readAt: null,
        createdAt: new Date("2026-10-19T05:00:00Z"),
      },
    ],
  };

  const limitMock = vi.fn(async () => state.items);
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn((_cond?: unknown) => {
    const promise = Promise.resolve([{ count: state.count }]);
    return Object.assign(promise, {
      orderBy: orderByMock,
      limit: limitMock,
    });
  });
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  const updateWhereMock = vi.fn(async () => [{ success: true }]);
  const setMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));

  return {
    state,
    selectMock,
    fromMock,
    whereMock,
    orderByMock,
    limitMock,
    updateMock,
    setMock,
    updateWhereMock,
  };
});

vi.mock("../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSessionMock } },
}));

vi.mock("../../../lib/db", () => ({
  db: {
    select: dbMock.selectMock,
    update: dbMock.updateMock,
  },
}));

import { GET, PATCH, POST } from "./route";

function makeJsonRequest(
  method: "GET" | "PATCH" | "POST",
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request("https://lagan.test/api/notifications", init);
}

describe("/api/notifications route", () => {
  beforeEach(() => {
    resetRateLimit();
    authMock.state.session = { user: { id: "user_1", tenantId: "default" } };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when session is unauthenticated", async () => {
      authMock.state.session = null;
      const res = await GET(makeJsonRequest("GET"));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "unauthorized" });
    });

    it("returns initial notifications and unread count", async () => {
      const res = await GET(makeJsonRequest("GET"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.unreadCount).toBe(3);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe("notif_1");
    });
  });

  describe("PATCH", () => {
    it("returns 401 when session is unauthenticated", async () => {
      authMock.state.session = null;
      const res = await PATCH(makeJsonRequest("PATCH", { id: "notif_1" }));
      expect(res.status).toBe(401);
    });

    it("marks single notification as read", async () => {
      const res = await PATCH(makeJsonRequest("PATCH", { id: "notif_1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(dbMock.updateMock).toHaveBeenCalled();
      expect(dbMock.setMock).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
    });

    it("marks all notifications as read when all: true", async () => {
      const res = await PATCH(makeJsonRequest("PATCH", { all: true }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(dbMock.updateMock).toHaveBeenCalled();
      expect(dbMock.setMock).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
    });

    it("returns 400 when missing parameters", async () => {
      const res = await PATCH(makeJsonRequest("PATCH", {}));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: "missing_parameters" });
    });

    it("returns 400 when body is invalid JSON", async () => {
      const req = new Request("https://lagan.test/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json{",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: "invalid_json" });
    });

    it("rejects unknown fields in payload", async () => {
      const res = await PATCH(makeJsonRequest("PATCH", { id: "notif_1", maliciousKey: "bad" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: "missing_parameters" });
    });

    it("rate limits burst PATCH requests exceeding 60 req/min per user", async () => {
      for (let i = 0; i < 60; i++) {
        const res = await PATCH(makeJsonRequest("PATCH", { id: "notif_1" }));
        expect(res.status).toBe(200);
      }

      const burstRes = await PATCH(makeJsonRequest("PATCH", { id: "notif_1" }));
      expect(burstRes.status).toBe(429);
      expect(burstRes.headers.get("Retry-After")).toBeDefined();
    });
  });

  describe("POST", () => {
    it("delegates to PATCH handler", async () => {
      const res = await POST(makeJsonRequest("POST", { id: "notif_1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
    });
  });
});
