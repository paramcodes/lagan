vi.mock("@mux/mux-player-react", () => ({ default: () => null }));

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseNotificationsResult } from "../hooks/use-notifications";
import {
  NotificationCenter,
  formatRelativeTime,
  getNotificationContent,
  getNotificationUrl,
} from "./notification-center";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
  }),
  usePathname: () => "/courses",
  useSearchParams: () => new URLSearchParams(),
}));

describe("notification-center helpers", () => {
  describe("formatRelativeTime", () => {
    it("handles falsy and invalid dates", () => {
      expect(formatRelativeTime(null)).toBe("");
      expect(formatRelativeTime(undefined)).toBe("");
      expect(formatRelativeTime("invalid-date")).toBe("");
    });

    it("formats seconds as just now", () => {
      const date = new Date(Date.now() - 30 * 1000);
      expect(formatRelativeTime(date)).toBe("just now");
    });

    it("formats minutes ago", () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe("5m ago");
    });

    it("formats hours ago", () => {
      const date = new Date(Date.now() - 3 * 3600 * 1000);
      expect(formatRelativeTime(date)).toBe("3h ago");
    });

    it("formats days ago", () => {
      const date = new Date(Date.now() - 4 * 24 * 3600 * 1000);
      expect(formatRelativeTime(date)).toBe("4d ago");
    });

    it("formats weeks ago", () => {
      const date = new Date(Date.now() - 14 * 24 * 3600 * 1000);
      expect(formatRelativeTime(date)).toBe("2w ago");
    });
  });

  describe("getNotificationUrl", () => {
    it("returns explicit payload.url if available", () => {
      const url = getNotificationUrl({
        id: "1",
        type: "course_published",
        payload: { url: "/custom/target/path", courseId: "c1" },
      });
      expect(url).toBe("/custom/target/path");
    });

    it("returns lesson url when courseId and lessonId are present", () => {
      const url = getNotificationUrl({
        id: "2",
        type: "lesson_published",
        payload: { courseId: "course-123", lessonId: "lesson-456" },
      });
      expect(url).toBe("/courses/course-123/lessons/lesson-456");
    });

    it("returns course url when only courseId is present", () => {
      const url = getNotificationUrl({
        id: "3",
        type: "course_published",
        payload: { courseId: "course-123" },
      });
      expect(url).toBe("/courses/course-123");
    });

    it("returns null when no url or courseId are present", () => {
      const url = getNotificationUrl({
        id: "4",
        type: "system_alert",
        payload: {},
      });
      expect(url).toBeNull();
    });
  });

  describe("getNotificationContent", () => {
    it("formats course_published content", () => {
      const content = getNotificationContent({
        id: "1",
        type: "course_published",
        payload: { courseTitle: "TypeScript Mastery" },
      });
      expect(content.title).toBe("Course published: TypeScript Mastery");
      expect(content.description).toBe("A new course is available in the catalogue.");
    });

    it("formats lesson_published content", () => {
      const content = getNotificationContent({
        id: "2",
        type: "lesson_published",
        payload: { title: "Async Iterators", courseTitle: "TypeScript Mastery" },
      });
      expect(content.title).toBe("Async Iterators");
      expect(content.description).toBe("New lesson added to TypeScript Mastery");
    });

    it("formats enrollment_confirmed content", () => {
      const content = getNotificationContent({
        id: "3",
        type: "enrollment_confirmed",
        payload: { courseTitle: "Rust Basics" },
      });
      expect(content.title).toBe("Enrollment confirmed");
      expect(content.description).toBe("You are enrolled in Rust Basics");
    });
  });
});

describe("NotificationCenter Component", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  const mockState = (overrides: Partial<UseNotificationsResult> = {}): UseNotificationsResult => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    isConnected: true,
    isPolling: false,
    ...overrides,
  });

  it("renders the bell trigger button with hidden unread counter when unreadCount is 0", () => {
    const state = mockState({ unreadCount: 0 });
    render(<NotificationCenter notificationState={state} />);

    const button = screen.getByRole("button", { name: "Notifications" });
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });

  it("renders live unread badge counter when unreadCount > 0", () => {
    const state = mockState({ unreadCount: 4 });
    render(<NotificationCenter notificationState={state} />);

    const button = screen.getByRole("button", { name: "Notifications (4 unread)" });
    expect(button).toBeDefined();
    const badge = screen.getByTestId("unread-badge");
    expect(badge.textContent).toBe("4");
  });

  it("caps badge text to 99+ when unreadCount > 99", () => {
    const state = mockState({ unreadCount: 150 });
    render(<NotificationCenter notificationState={state} />);

    const badge = screen.getByTestId("unread-badge");
    expect(badge.textContent).toBe("99+");
  });

  it("opens popover dialog on bell click and closes on Escape", () => {
    const state = mockState({ unreadCount: 0 });
    render(<NotificationCenter notificationState={state} />);

    const button = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders EmptyState when notifications list is empty", () => {
    const state = mockState({ notifications: [], unreadCount: 0 });
    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("No notifications yet")).toBeDefined();
  });

  it("displays live SSE connection indicator with green pulsing dot", () => {
    const state = mockState({ isConnected: true, isPolling: false });
    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    expect(screen.getByLabelText("Connected (live)")).toBeDefined();
    expect(screen.getByText("Live")).toBeDefined();
  });

  it("displays amber polling connection indicator when isPolling is true", () => {
    const state = mockState({ isConnected: true, isPolling: true });
    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    expect(screen.getByLabelText("Connected (polling)")).toBeDefined();
    expect(screen.getByText("Polling")).toBeDefined();
  });

  it("renders notification items with unread styling, icons, and timestamps", () => {
    const items = [
      {
        id: "notif-1",
        type: "course_published",
        payload: { courseId: "course-1", courseTitle: "Distributed Systems" },
        readAt: null,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: "notif-2",
        type: "lesson_published",
        payload: {
          courseId: "course-1",
          lessonId: "lesson-2",
          title: "Consensus Algorithms",
        },
        readAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
      {
        id: "notif-3",
        type: "enrollment_confirmed",
        payload: { courseId: "course-2", courseTitle: "Kubernetes in Action" },
        readAt: null,
        createdAt: new Date(Date.now() - 20 * 1000).toISOString(),
      },
    ];

    const state = mockState({
      notifications: items,
      unreadCount: 2,
    });

    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    expect(screen.getByText("Course published: Distributed Systems")).toBeDefined();
    expect(screen.getByText("Consensus Algorithms")).toBeDefined();
    expect(screen.getByText("Enrollment confirmed")).toBeDefined();

    // Check type icons
    expect(screen.getByTestId("icon-course-published")).toBeDefined();
    expect(screen.getByTestId("icon-lesson-published")).toBeDefined();
    expect(screen.getByTestId("icon-enrollment-confirmed")).toBeDefined();

    // Check unread indicators
    const unreadDots = screen.getAllByTestId("unread-dot");
    expect(unreadDots.length).toBe(2);

    // Relative timestamps
    expect(screen.getByText("5m ago")).toBeDefined();
    expect(screen.getByText("1h ago")).toBeDefined();
    expect(screen.getByText("just now")).toBeDefined();
  });

  it("clicks Mark all as read button when unreadCount > 0", async () => {
    const markAllMock = vi.fn().mockResolvedValue(undefined);
    const state = mockState({
      notifications: [
        {
          id: "n1",
          type: "course_published",
          readAt: null,
          payload: { courseId: "c1", courseTitle: "Course 1" },
        },
      ],
      unreadCount: 1,
      markAllAsRead: markAllMock,
    });

    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    const markAllBtn = screen.getByRole("button", { name: "Mark all as read" });
    expect(markAllBtn.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      fireEvent.click(markAllBtn);
    });

    expect(markAllMock).toHaveBeenCalledTimes(1);
  });

  it("disables Mark all as read button when unreadCount is 0", () => {
    const state = mockState({
      notifications: [
        {
          id: "n1",
          type: "course_published",
          readAt: new Date().toISOString(),
          payload: { courseId: "c1", courseTitle: "Course 1" },
        },
      ],
      unreadCount: 0,
    });

    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    const markAllBtn = screen.getByRole("button", { name: "Mark all as read" });
    expect(markAllBtn.hasAttribute("disabled")).toBe(true);
  });

  it("marks item as read and navigates to target URL when clicking item", async () => {
    const markAsReadMock = vi.fn().mockResolvedValue(undefined);
    const state = mockState({
      notifications: [
        {
          id: "n-unread",
          type: "lesson_published",
          payload: {
            courseId: "course-99",
            lessonId: "lesson-77",
            title: "Raft Protocol",
          },
          readAt: null,
        },
      ],
      unreadCount: 1,
      markAsRead: markAsReadMock,
    });

    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    const itemBtn = screen.getByRole("button", { name: /^Raft Protocol/ });
    await act(async () => {
      fireEvent.click(itemBtn);
    });

    expect(markAsReadMock).toHaveBeenCalledWith("n-unread");
    expect(pushMock).toHaveBeenCalledWith("/courses/course-99/lessons/lesson-77");
    // Popover closes after navigating
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks individual item as read without navigation when clicking per-item mark as read button", async () => {
    const markAsReadMock = vi.fn().mockResolvedValue(undefined);
    const state = mockState({
      notifications: [
        {
          id: "item-to-mark",
          type: "course_published",
          payload: {
            courseId: "c-100",
            courseTitle: "Cloud Architecture",
          },
          readAt: null,
        },
      ],
      unreadCount: 1,
      markAsRead: markAsReadMock,
    });

    render(<NotificationCenter notificationState={state} defaultOpen={true} />);

    const markSingleBtn = screen.getByRole("button", {
      name: 'Mark "Course published: Cloud Architecture" as read',
    });

    await act(async () => {
      fireEvent.click(markSingleBtn);
    });

    expect(markAsReadMock).toHaveBeenCalledWith("item-to-mark");
    // Item button navigation was NOT triggered
    expect(pushMock).not.toHaveBeenCalled();
    // Popover remains open
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
