import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "../../../../lib/rate-limit";

const authHandlers = toNextJsHandler(auth);

export const GET = authHandlers.GET;

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isCredentialOrAuthAttempt =
    url.pathname.includes("/sign-in") ||
    url.pathname.includes("/sign-up") ||
    url.pathname.includes("/reset-password") ||
    url.pathname.includes("/change-password");

  if (isCredentialOrAuthAttempt) {
    const ip = getClientIp(request.headers);
    const limit = checkRateLimit(`auth:${ip}`, 10, 60);
    if (!limit.allowed) {
      return rateLimitResponse(limit.resetSeconds);
    }
  }

  return authHandlers.POST(request);
}
