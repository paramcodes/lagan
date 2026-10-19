import { auth } from "../../../lib/auth";
import {
  getInitialNotificationState,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../../lib/notifications";

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

  let body: Record<string, unknown> = {};
  try {
    const json = await request.json();
    if (json && typeof json === "object") {
      body = json as Record<string, unknown>;
    }
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.all === true) {
    await markAllNotificationsAsRead(userId, tenantId);
    return Response.json({ success: true });
  }

  if (typeof body.id === "string" && body.id.length > 0) {
    await markNotificationAsRead(userId, tenantId, body.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "missing_parameters" }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  return PATCH(request);
}
