import { beforeEach, describe, expect, it } from "vitest";
import {
  RateLimitError,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  resetRateLimit,
} from "./rate-limit";

describe("rateLimit utility", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("burst allowance: allows requests within limit and decrements remaining count", () => {
    const key = "ip:192.168.1.1";
    const limit = 3;
    const windowSeconds = 60;
    const t0 = 1_000_000;

    const first = checkRateLimit(key, limit, windowSeconds, t0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(first.resetSeconds).toBe(60);

    const second = checkRateLimit(key, limit, windowSeconds, t0 + 1000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
    expect(second.resetSeconds).toBe(59);

    const third = checkRateLimit(key, limit, windowSeconds, t0 + 2000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(third.resetSeconds).toBe(58);
  });

  it("threshold rejection: rejects requests exceeding limit with 0 remaining", () => {
    const key = "ip:192.168.1.2";
    const limit = 2;
    const windowSeconds = 60;
    const t0 = 1_000_000;

    checkRateLimit(key, limit, windowSeconds, t0);
    checkRateLimit(key, limit, windowSeconds, t0 + 5000);

    // Exceeding burst limit
    const exceeded = checkRateLimit(key, limit, windowSeconds, t0 + 10000);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.remaining).toBe(0);
    expect(exceeded.resetSeconds).toBe(50);

    // Generates 429 response
    const response = rateLimitResponse(exceeded.resetSeconds);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("50");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("50");
  });

  it("window expiry reset: restores capacity after sliding window expires", () => {
    const key = "ip:192.168.1.3";
    const limit = 2;
    const windowSeconds = 60;
    const t0 = 1_000_000;

    // Fill capacity
    checkRateLimit(key, limit, windowSeconds, t0);
    checkRateLimit(key, limit, windowSeconds, t0 + 5000);

    // Blocked before window expiry
    const blocked = checkRateLimit(key, limit, windowSeconds, t0 + 30000);
    expect(blocked.allowed).toBe(false);

    // After first request expires (t0 + 60_001)
    const afterFirstExpiry = checkRateLimit(key, limit, windowSeconds, t0 + 60_001);
    expect(afterFirstExpiry.allowed).toBe(true);
    expect(afterFirstExpiry.remaining).toBe(0); // 1 active (from t0 + 5000) + 1 new = 2 = limit

    // After all previous requests expire (t0 + 65_001 + 60_001)
    const afterAllExpired = checkRateLimit(key, limit, windowSeconds, t0 + 130_000);
    expect(afterAllExpired.allowed).toBe(true);
    expect(afterAllExpired.remaining).toBe(1); // Fresh window: 1 new request, 1 remaining
  });

  it("isolates rate limits by distinct key", () => {
    const limit = 1;
    const windowSeconds = 60;
    const t0 = 1_000_000;

    const ipA = checkRateLimit("ip:10.0.0.1", limit, windowSeconds, t0);
    expect(ipA.allowed).toBe(true);

    const ipABlocked = checkRateLimit("ip:10.0.0.1", limit, windowSeconds, t0);
    expect(ipABlocked.allowed).toBe(false);

    // Different key should still be allowed
    const ipB = checkRateLimit("ip:10.0.0.2", limit, windowSeconds, t0);
    expect(ipB.allowed).toBe(true);
  });

  it("handles limit <= 0 gracefully", () => {
    const res = checkRateLimit("ip:blocked", 0, 60);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it("resets specific key or all keys", () => {
    const limit = 1;
    checkRateLimit("key1", limit, 60);
    checkRateLimit("key2", limit, 60);

    expect(checkRateLimit("key1", limit, 60).allowed).toBe(false);
    expect(checkRateLimit("key2", limit, 60).allowed).toBe(false);

    resetRateLimit("key1");
    expect(checkRateLimit("key1", limit, 60).allowed).toBe(true);
    expect(checkRateLimit("key2", limit, 60).allowed).toBe(false);

    resetRateLimit();
    expect(checkRateLimit("key2", limit, 60).allowed).toBe(true);
  });

  describe("getClientIp", () => {
    it("extracts first IP from x-forwarded-for header", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      });
      expect(getClientIp(headers)).toBe("203.0.113.195");
    });

    it("extracts IP from x-real-ip header", () => {
      const headers = new Headers({
        "x-real-ip": "198.51.100.1",
      });
      expect(getClientIp(headers)).toBe("198.51.100.1");
    });

    it("extracts IP from cf-connecting-ip header", () => {
      const headers = new Headers({
        "cf-connecting-ip": "198.51.100.2",
      });
      expect(getClientIp(headers)).toBe("198.51.100.2");
    });

    it("falls back to 127.0.0.1 when no headers present", () => {
      const headers = new Headers();
      expect(getClientIp(headers)).toBe("127.0.0.1");
    });
  });

  describe("RateLimitError", () => {
    it("has 429 status and resetSeconds", () => {
      const error = new RateLimitError(45);
      expect(error.status).toBe(429);
      expect(error.resetSeconds).toBe(45);
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("Too many requests. Please try again later.");
    });
  });
});
