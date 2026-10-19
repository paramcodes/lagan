import { notifications, type Notification } from "@lagan/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db as defaultDb } from "./db";

export const MAX_CONCURRENT_SSE_PER_USER = 3;

export type NotificationCallback = (notification: Notification) => void;

export class NotificationBus {
  private listeners = new Map<string, Set<NotificationCallback>>();

  subscribe(userId: string, callback: NotificationCallback): () => void {
    let userListeners = this.listeners.get(userId);
    if (!userListeners) {
      userListeners = new Set();
      this.listeners.set(userId, userListeners);
    }
    userListeners.add(callback);

    return () => {
      userListeners?.delete(callback);
      if (userListeners?.size === 0) {
        this.listeners.delete(userId);
      }
    };
  }

  publish(notification: Notification): void {
    const userListeners = this.listeners.get(notification.userId);
    if (userListeners) {
      for (const listener of userListeners) {
        try {
          listener(notification);
        } catch (err) {
          console.error("Error dispatching notification to subscriber:", err);
        }
      }
    }
  }

  activeConnectionsCount(userId?: string): number {
    if (userId) {
      return this.listeners.get(userId)?.size ?? 0;
    }
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const notificationBus = new NotificationBus();

export interface FormatSseFrameOptions {
  event?: string;
  data?: unknown;
  id?: string;
  comment?: string;
}

export function formatSseFrame({ event, data, id, comment }: FormatSseFrameOptions): string {
  let frame = "";
  if (comment !== undefined) {
    frame += `: ${comment}\n`;
  }
  if (id !== undefined) {
    frame += `id: ${id}\n`;
  }
  if (event !== undefined) {
    frame += `event: ${event}\n`;
  }
  if (data !== undefined) {
    const raw = typeof data === "string" ? data : JSON.stringify(data);
    frame += `data: ${raw}\n`;
  }
  frame += "\n";
  return frame;
}

export interface InitialNotificationState {
  unreadCount: number;
  items: Notification[];
}

export async function getInitialNotificationState(
  userId: string,
  tenantId: string,
  limit = 50,
  dbInstance = defaultDb,
): Promise<InitialNotificationState> {
  const [countResult] = await dbInstance
    .select({
      count: sql<number>`coalesce(count(${notifications.id}), 0)::int`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId),
        isNull(notifications.readAt),
      ),
    );

  const unreadCount = Number(countResult?.count ?? 0);

  const items = await dbInstance
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.tenantId, tenantId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return {
    unreadCount,
    items,
  };
}

export async function markNotificationAsRead(
  userId: string,
  tenantId: string,
  notificationId: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const now = new Date();
  await dbInstance
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId),
      ),
    );
  return true;
}

export async function markAllNotificationsAsRead(
  userId: string,
  tenantId: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const now = new Date();
  await dbInstance
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId),
        isNull(notifications.readAt),
      ),
    );
  return true;
}
