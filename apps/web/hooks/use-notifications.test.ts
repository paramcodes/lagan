import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type NotificationItem, useNotifications } from "./use-notifications";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data: unknown) {
    const rawData = typeof data === "string" ? data : JSON.stringify(data);
    const event = new MessageEvent(type, { data: rawData });
    const set = this.listeners.get(type);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  error() {
    this.readyState = 2;
    this.onerror?.(new Event("error"));
  }

  close() {
    this.readyState = 2;
  }
}

function getMockEventSource(index = 0): MockEventSource {
  const instance = MockEventSource.instances[index];
  if (!instance) {
    throw new Error(`MockEventSource at index ${index} not found`);
  }
  return instance;
}

function getNotification(notifications: NotificationItem[], index = 0): NotificationItem {
  const item = notifications[index];
  if (!item) {
    throw new Error(`Notification at index ${index} not found`);
  }
  return item;
}

describe("useNotifications hook", () => {
  let originalEventSource: typeof EventSource;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    originalEventSource = global.EventSource;
    originalFetch = global.fetch;
    (global as unknown as { EventSource: unknown }).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.EventSource = originalEventSource;
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("connects to /api/notifications/stream by default", () => {
    const { result } = renderHook(() => useNotifications());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(getMockEventSource(0).url).toBe("/api/notifications/stream");
    expect(result.current.isConnected).toBe(false);

    act(() => {
      getMockEventSource(0).open();
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("handles initial sync frame and sets notifications and unreadCount", () => {
    const { result } = renderHook(() => useNotifications());
    const es = getMockEventSource(0);

    const initialItems: NotificationItem[] = [
      {
        id: "1",
        type: "lesson_published",
        readAt: null,
        createdAt: "2026-10-19T00:00:00Z",
      },
      {
        id: "2",
        type: "course_published",
        readAt: "2026-10-19T01:00:00Z",
        createdAt: "2026-10-19T00:30:00Z",
      },
    ];

    act(() => {
      es.emit("sync", {
        unreadCount: 1,
        items: initialItems,
      });
    });

    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications).toEqual(initialItems);
    expect(result.current.isConnected).toBe(true);
  });

  it("handles incoming real-time notification frame", () => {
    const onNotification = vi.fn();
    const { result } = renderHook(() => useNotifications({ onNotification }));
    const es = getMockEventSource(0);

    act(() => {
      es.emit("sync", { unreadCount: 0, items: [] });
    });

    const newNotification: NotificationItem = {
      id: "3",
      type: "announcement_posted",
      readAt: null,
      createdAt: "2026-10-19T02:00:00Z",
    };

    act(() => {
      es.emit("notification", newNotification);
    });

    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications).toEqual([newNotification]);
    expect(onNotification).toHaveBeenCalledWith(newNotification);
  });

  it("deduplicates notifications by id when receiving repeated notification frames", () => {
    const { result } = renderHook(() => useNotifications());
    const es = getMockEventSource(0);

    const item: NotificationItem = {
      id: "dup_1",
      type: "lesson_published",
      readAt: null,
      createdAt: "2026-10-19T02:00:00Z",
    };

    act(() => {
      es.emit("notification", item);
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      es.emit("notification", item);
    });
    expect(result.current.notifications).toHaveLength(1);
  });

  it("reconnects with exponential backoff on error", () => {
    renderHook(() =>
      useNotifications({
        baseBackoffMs: 1000,
        maxRetries: 3,
        jitterMs: 0,
      }),
    );

    expect(MockEventSource.instances).toHaveLength(1);
    const es1 = getMockEventSource(0);

    // First error: schedules reconnect after 1000ms
    act(() => {
      es1.error();
    });
    expect(es1.readyState).toBe(2);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Second error: schedules reconnect after 2000ms (1000 * 2^1)
    const es2 = getMockEventSource(1);
    act(() => {
      es2.error();
    });

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("falls back to REST polling after repeated SSE errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        unreadCount: 5,
        items: [{ id: "fallback_1", type: "lesson_published", readAt: null }],
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useNotifications({
        maxRetries: 2,
        baseBackoffMs: 100,
        jitterMs: 0,
        fallbackPollIntervalMs: 5000,
      }),
    );

    const es1 = getMockEventSource(0);
    act(() => {
      es1.error();
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    const es2 = getMockEventSource(1);
    // Reached maxRetries (2)
    await act(async () => {
      es2.error();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications");
    expect(result.current.unreadCount).toBe(5);
    expect(getNotification(result.current.notifications, 0).id).toBe("fallback_1");

    // Advance to next poll interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to REST if EventSource is not supported", async () => {
    (global as unknown as { EventSource: unknown }).EventSource = undefined;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        unreadCount: 2,
        items: [{ id: "no_sse", type: "course_published", readAt: null }],
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useNotifications({ fallbackPollIntervalMs: 1000 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications");
    expect(result.current.unreadCount).toBe(2);
    expect(getNotification(result.current.notifications, 0).id).toBe("no_sse");
  });

  it("optimistically marks a notification as read and rolls back on failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useNotifications());
    const es = getMockEventSource(0);

    act(() => {
      es.emit("sync", {
        unreadCount: 1,
        items: [
          {
            id: "target_1",
            type: "lesson_published",
            readAt: null,
            createdAt: "2026-10-19T00:00:00Z",
          },
        ],
      });
    });

    expect(result.current.unreadCount).toBe(1);
    expect(getNotification(result.current.notifications, 0).readAt).toBeNull();

    // Successful markAsRead
    await act(async () => {
      await result.current.markAsRead("target_1");
    });

    expect(result.current.unreadCount).toBe(0);
    expect(getNotification(result.current.notifications, 0).readAt).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ id: "target_1" }),
      }),
    );

    // Rollback test on failure
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    let caughtError: unknown = null;
    await act(async () => {
      try {
        await result.current.markAsRead("target_1");
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).not.toBeNull();
  });

  it("optimistically marks all notifications as read and rolls back on failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useNotifications());
    const es = getMockEventSource(0);

    const initialItems: NotificationItem[] = [
      { id: "a", type: "lesson_published", readAt: null },
      { id: "b", type: "course_published", readAt: null },
    ];

    act(() => {
      es.emit("sync", {
        unreadCount: 2,
        items: initialItems,
      });
    });

    expect(result.current.unreadCount).toBe(2);

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(getNotification(result.current.notifications, 0).readAt).not.toBeNull();
    expect(getNotification(result.current.notifications, 1).readAt).not.toBeNull();

    // Rollback test
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: "Server Error" });

    // Reset to unread
    act(() => {
      es.emit("sync", {
        unreadCount: 2,
        items: initialItems,
      });
    });
    expect(result.current.unreadCount).toBe(2);

    let error: unknown = null;
    await act(async () => {
      try {
        await result.current.markAllAsRead();
      } catch (err) {
        error = err;
      }
    });

    expect(error).not.toBeNull();
    // Rolled back
    expect(result.current.unreadCount).toBe(2);
    expect(getNotification(result.current.notifications, 0).readAt).toBeNull();
    expect(getNotification(result.current.notifications, 1).readAt).toBeNull();
  });

  it("reconnects when the window online event fires", () => {
    renderHook(() => useNotifications());
    expect(MockEventSource.instances).toHaveLength(1);

    const es1 = getMockEventSource(0);
    act(() => {
      es1.error();
    });

    // Simulate online event
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("cleans up EventSource and timers on unmount", () => {
    const { unmount } = renderHook(() => useNotifications());
    const es = getMockEventSource(0);
    expect(es.readyState).toBe(0);

    unmount();
    expect(es.readyState).toBe(2);
  });
});
