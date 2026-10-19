export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

const memoryStore = new Map<string, number[]>();
const MAX_KEYS = 50_000;

/**
 * Sliding window rate limiter based on in-memory timestamps per key (IP, user token, etc.).
 *
 * @param key Unique key to rate limit (e.g. `auth:${ip}`, `checkout:${userId}`).
 * @param limit Maximum allowed requests within the window.
 * @param windowSeconds Duration of sliding window in seconds.
 * @param now Optional timestamp in ms (defaults to Date.now(), useful for testing).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now(),
): RateLimitResult {
  if (limit <= 0) {
    return { allowed: false, remaining: 0, resetSeconds: Math.max(1, windowSeconds) };
  }

  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  let timestamps = memoryStore.get(key);
  if (!timestamps) {
    timestamps = [];
    if (memoryStore.size >= MAX_KEYS) {
      for (const [k, tsList] of memoryStore.entries()) {
        const filtered = tsList.filter((ts) => ts > cutoff);
        if (filtered.length === 0) {
          memoryStore.delete(k);
        } else {
          memoryStore.set(k, filtered);
        }
      }
    }
  } else {
    timestamps = timestamps.filter((ts) => ts > cutoff);
  }

  const count = timestamps.length;
  if (count < limit) {
    timestamps.push(now);
    memoryStore.set(key, timestamps);
    const remaining = limit - count - 1;
    const oldest = timestamps[0] ?? now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: true,
      remaining,
      resetSeconds,
    };
  }

  memoryStore.set(key, timestamps);
  const oldest = timestamps[0] ?? now - windowMs;
  const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  return {
    allowed: false,
    remaining: 0,
    resetSeconds,
  };
}

/**
 * Resets rate limit for a single key or all keys (useful for testing and cleanup).
 */
export function resetRateLimit(key?: string): void {
  if (key) {
    memoryStore.delete(key);
  } else {
    memoryStore.clear();
  }
}

/**
 * Resolves the client IP from request headers, respecting common reverse-proxy headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfConnectingIp = headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  return "127.0.0.1";
}

/**
 * Generates a standardized 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(resetSeconds: number): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetSeconds),
        "X-RateLimit-Reset": String(resetSeconds),
      },
    },
  );
}

/**
 * Error thrown by mutating server actions when rate limit threshold is exceeded.
 */
export class RateLimitError extends Error {
  readonly status = 429;
  readonly resetSeconds: number;

  constructor(resetSeconds: number = 60, message = "Too many requests. Please try again later.") {
    super(message);
    this.name = "RateLimitError";
    this.resetSeconds = resetSeconds;
  }
}
