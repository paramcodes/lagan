import { z } from "zod";
import { auth } from "../../../lib/auth";
import {
  getInitialNotificationState,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../../lib/notifications";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";

const patchNotificationSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ id: z.string().min(1) }).strict(),
]);

function resolveTenantId(sessionUser: unknown, headers: Headers): string {
  if (
    sessionUser &&
    typeof sessionUser === "object" &&
    "tenantId" in sessionUser &&
    typeof sessionUser.tenantId === "string"
  ) {
    return sessionUser.tenantId;
  }
  return headers.get("x-tenant-id") ?? "default";
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = resolveTenantId(session.user, request.headers);

  const state = await getInitialNotificationState(userId, tenantId);
  return Response.json({
    unreadCount: state.unreadCount,
    items: state.items,
    notifications: state.items,
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = resolveTenantId(session.user, request.headers);

  const rl = checkRateLimit(`notifications:${userId}`, 60, 60);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetSeconds);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchNotificationSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "missing_parameters" }, { status: 400 });
  }
  const body = parsed.data;
  if ("all" in body && body.all === true) {
    await markAllNotificationsAsRead(userId, tenantId);
    return Response.json({ success: true });
  }

  if ("id" in body && typeof body.id === "string" && body.id.length > 0) {
    await markNotificationAsRead(userId, tenantId, body.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "missing_parameters" }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  return PATCH(request);
}
