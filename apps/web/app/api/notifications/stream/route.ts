import { auth } from "../../../../lib/auth";
import {
  formatSseFrame,
  getInitialNotificationState,
  MAX_CONCURRENT_SSE_PER_USER,
  notificationBus,
} from "../../../../lib/notifications";

const DEFAULT_PING_INTERVAL_MS = 20_000;

export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const user = session.user;
  const sessionTenantId =
    user && typeof user === "object" && "tenantId" in user && typeof user.tenantId === "string"
      ? user.tenantId
      : null;
  const tenantId = sessionTenantId ?? request.headers.get("x-tenant-id") ?? "default";
  if (notificationBus.activeConnectionsCount(userId) >= MAX_CONCURRENT_SSE_PER_USER) {
    return Response.json(
      { error: "too_many_connections", message: "Concurrent stream limit reached" },
      { status: 429 },
    );
  }

  const pingIntervalMs = Number(
    process.env.NOTIFICATIONS_PING_INTERVAL_MS ?? DEFAULT_PING_INTERVAL_MS,
  );

  let initialState: { unreadCount: number; items: unknown[] };
  try {
    initialState = await getInitialNotificationState(userId, tenantId);
  } catch (err) {
    console.error("Failed to fetch initial notifications:", err);
    initialState = { unreadCount: 0, items: [] };
  }

  const encoder = new TextEncoder();
  let pingTimer: NodeJS.Timeout | number | null = null;
  let unsubscribe: (() => void) | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      function send(frame: string) {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          cleanup();
        }
      }

      function cleanup() {
        if (isClosed) return;
        isClosed = true;
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          // ignore if already closed
        }
      }

      // 1. Initial sync frame
      send(
        formatSseFrame({
          event: "sync",
          data: {
            unreadCount: initialState.unreadCount,
            items: initialState.items,
          },
        }),
      );

      // 2. Real-time notification subscription
      unsubscribe = notificationBus.subscribe(userId, (notification) => {
        send(
          formatSseFrame({
            event: "notification",
            id: notification.id,
            data: notification,
          }),
        );
      });

      // 3. Periodic ping heartbeat (comment + ping event)
      pingTimer = setInterval(() => {
        send(
          formatSseFrame({
            comment: "ping",
            event: "ping",
            data: { timestamp: Date.now() },
          }),
        );
      }, pingIntervalMs);

      // Clean cleanup on client abort / disconnect
      if (request.signal) {
        if (request.signal.aborted) {
          cleanup();
        } else {
          request.signal.addEventListener("abort", cleanup, { once: true });
        }
      }
    },
    cancel() {
      isClosed = true;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
