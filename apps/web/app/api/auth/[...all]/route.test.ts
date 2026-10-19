import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../lib/rate-limit";

const { authPostMock, authGetMock } = vi.hoisted(() => ({
  authPostMock: vi.fn(async () => new Response(JSON.stringify({ success: true }))),
  authGetMock: vi.fn(async () => new Response(JSON.stringify({ status: "ok" }))),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: authGetMock,
    POST: authPostMock,
  })),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {},
}));

import { GET, POST } from "./route";

describe("/api/auth/[...all] rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
  });

  it("passes GET requests without rate limiting", async () => {
    const request = new Request("http://localhost:3000/api/auth/session");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(authGetMock).toHaveBeenCalled();
  });

  it("allows up to 10 sign-in credential attempts and blocks the 11th with 429", async () => {
    const headers = {
      "x-forwarded-for": "198.51.100.50",
      "content-type": "application/json",
    };

    // 10 allowed attempts
    for (let i = 0; i < 10; i++) {
      const request = new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "user@example.com", password: "wrong" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(200);
    }
    expect(authPostMock).toHaveBeenCalledTimes(10);

    // 11th attempt: burst limit exceeded -> 429
    const burstRequest = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "user@example.com", password: "wrong" }),
    });
    const response = await POST(burstRequest);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();
    const data = await response.json();
    expect(data.error).toContain("Too many requests");

    // auth handler not called on the 11th request
    expect(authPostMock).toHaveBeenCalledTimes(10);
  });

  it("does not rate limit separate client IPs", async () => {
    const headers1 = { "x-forwarded-for": "198.51.100.51" };
    const headers2 = { "x-forwarded-for": "198.51.100.52" };

    for (let i = 0; i < 10; i++) {
      const request = new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: headers1,
      });
      const res = await POST(request);
      expect(res.status).toBe(200);
    }

    // IP 1 is now blocked
    const res1 = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: headers1,
      }),
    );
    expect(res1.status).toBe(429);

    // IP 2 is still allowed
    const res2 = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: headers2,
      }),
    );
    expect(res2.status).toBe(200);
  });
});
