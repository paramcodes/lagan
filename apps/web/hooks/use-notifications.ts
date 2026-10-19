"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  tenantId?: string;
  userId?: string;
  type: string;
  payload?: Record<string, unknown>;
  readAt?: string | Date | null;
  createdAt?: string | Date;
  [key: string]: unknown;
}

export interface UseNotificationsOptions {
  enabled?: boolean;
  streamUrl?: string;
  fallbackUrl?: string;
  maxRetries?: number;
  fallbackPollIntervalMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterMs?: number;
  onNotification?: (notification: NotificationItem) => void;
}

export interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  isConnected: boolean;
  isPolling: boolean;
}

type TimeoutHandle = number | NodeJS.Timeout;

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsResult {
  const {
    enabled = true,
    streamUrl = "/api/notifications/stream",
    fallbackUrl = "/api/notifications",
    maxRetries = 5,
    fallbackPollIntervalMs = 60_000,
    baseBackoffMs = 1_000,
    maxBackoffMs = 30_000,
    jitterMs = 250,
    onNotification,
  } = options;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<TimeoutHandle | undefined>(undefined);
  const pollTimerRef = useRef<TimeoutHandle | undefined>(undefined);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const isFallbackModeRef = useRef<boolean>(false);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;

  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const fetchRestFallback = useCallback(async () => {
    try {
      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        if (isMountedRef.current) {
          setIsConnected(false);
        }
        return;
      }
      const data: unknown = await response.json();
      if (!isMountedRef.current) return;

      if (data && typeof data === "object") {
        const rawItems =
          "items" in data && Array.isArray(data.items)
            ? data.items
            : "notifications" in data && Array.isArray(data.notifications)
              ? data.notifications
              : [];
        const items = rawItems as NotificationItem[];

        const rawCount =
          "unreadCount" in data && typeof data.unreadCount === "number"
            ? data.unreadCount
            : items.filter((n) => !n.readAt).length;

        setNotifications(items);
        setUnreadCount(rawCount);
        setIsConnected(true);
      }
    } catch {
      if (isMountedRef.current) {
        setIsConnected(false);
      }
    }
  }, [fallbackUrl]);

  const connectSSE = useCallback(() => {
    if (!isMountedRef.current) return;

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      isFallbackModeRef.current = true;
      setIsPolling(true);
      fetchRestFallback();
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(fetchRestFallback, fallbackPollIntervalMs);
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        retryCountRef.current = 0;
        isFallbackModeRef.current = false;
        setIsPolling(false);
        if (pollTimerRef.current) {
          pollTimerRef.current = undefined;
        }
      };

      es.addEventListener("sync", (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const payload: unknown = JSON.parse(event.data);
          if (payload && typeof payload === "object") {
            const rawItems =
              "items" in payload && Array.isArray(payload.items)
                ? payload.items
                : "notifications" in payload && Array.isArray(payload.notifications)
                  ? payload.notifications
                  : [];
            const items = rawItems as NotificationItem[];

            const count =
              "unreadCount" in payload && typeof payload.unreadCount === "number"
                ? payload.unreadCount
                : items.filter((n) => !n.readAt).length;

            setNotifications(items);
            setUnreadCount(count);
            setIsConnected(true);
            retryCountRef.current = 0;
          }
        } catch (err) {
          console.error("Failed to parse sync frame:", err);
        }
      });

      es.addEventListener("notification", (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const item: unknown = JSON.parse(event.data);
          if (item && typeof item === "object" && "id" in item && typeof item.id === "string") {
            const notification = item as NotificationItem;
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === notification.id);
              if (exists) {
                return prev.map((n) => (n.id === notification.id ? notification : n));
              }
              return [notification, ...prev];
            });

            if (!notification.readAt) {
              setUnreadCount((prev) => prev + 1);
            }

            onNotificationRef.current?.(notification);
          }
        } catch (err) {
          console.error("Failed to parse notification frame:", err);
        }
      });

      es.addEventListener("ping", () => {
        // Keepalive acknowledged
      });

      es.onerror = () => {
        if (!isMountedRef.current) return;
        es.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        retryCountRef.current += 1;

        if (retryCountRef.current >= maxRetries) {
          isFallbackModeRef.current = true;
          setIsPolling(true);
          fetchRestFallback();
          if (!pollTimerRef.current) {
            pollTimerRef.current = setInterval(fetchRestFallback, fallbackPollIntervalMs);
          }
        } else {
          const exp = Math.min(maxBackoffMs, baseBackoffMs * 2 ** (retryCountRef.current - 1));
          const jitter = (Math.random() * 2 - 1) * jitterMs;
          const delay = Math.max(50, Math.floor(exp + jitter));

          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connectSSE();
            }
          }, delay);
        }
      };
    } catch {
      if (!isMountedRef.current) return;
      setIsConnected(false);
      isFallbackModeRef.current = true;
      setIsPolling(true);
      fetchRestFallback();
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(fetchRestFallback, fallbackPollIntervalMs);
      }
    }
  }, [
    streamUrl,
    maxRetries,
    fallbackPollIntervalMs,
    baseBackoffMs,
    maxBackoffMs,
    jitterMs,
    fetchRestFallback,
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      setIsConnected(false);
      return;
    }

    connectSSE();

    const handleOnline = () => {
      if (isMountedRef.current && (!eventSourceRef.current || isFallbackModeRef.current)) {
        retryCountRef.current = 0;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = undefined;
        }
        connectSSE();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("online", handleOnline);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = undefined;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
    };
  }, [enabled, connectSSE]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const previousNotifications = notificationsRef.current;
      const previousUnreadCount = unreadCountRef.current;
      const target = previousNotifications.find((n) => n.id === notificationId);
      const wasUnread = Boolean(target && !target.readAt);

      const now = new Date().toISOString();
      setNotifications(
        previousNotifications.map((n) => (n.id === notificationId ? { ...n, readAt: now } : n)),
      );
      if (wasUnread) {
        setUnreadCount(Math.max(0, previousUnreadCount - 1));
      }

      try {
        const res = await fetch(fallbackUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notificationId }),
        });
        if (!res.ok) {
          throw new Error(`Failed to mark notification as read: ${res.statusText}`);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setNotifications(previousNotifications);
          if (wasUnread) {
            setUnreadCount(previousUnreadCount);
          }
        }
        throw err;
      }
    },
    [fallbackUrl],
  );

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notificationsRef.current;
    const previousUnreadCount = unreadCountRef.current;

    const now = new Date().toISOString();
    setNotifications(previousNotifications.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);

    try {
      const res = await fetch(fallbackUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) {
        throw new Error(`Failed to mark all as read: ${res.statusText}`);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      }
      throw err;
    }
  }, [fallbackUrl]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isConnected,
    isPolling,
  };
}
