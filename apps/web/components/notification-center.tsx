"use client";

import { EmptyState } from "@lagan/ui";
import { Bell, BookOpen, Check, FileText, Megaphone, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  type NotificationItem,
  type UseNotificationsOptions,
  type UseNotificationsResult,
  useNotifications,
} from "../hooks/use-notifications";

export interface NotificationCenterProps {
  options?: UseNotificationsOptions;
  notificationState?: UseNotificationsResult;
  defaultOpen?: boolean;
  className?: string;
}

export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function getNotificationUrl(notification: NotificationItem): string | null {
  const p = notification.payload;
  if (!p || typeof p !== "object") return null;
  if (typeof p.url === "string" && p.url) return p.url;
  if (typeof p.courseId === "string" && p.courseId) {
    return typeof p.lessonId === "string" && p.lessonId
      ? `/courses/${p.courseId}/lessons/${p.lessonId}`
      : `/courses/${p.courseId}`;
  }
  return null;
}

export function getNotificationContent(notification: NotificationItem): {
  title: string;
  description: string;
} {
  const p = (notification.payload ?? {}) as Record<string, unknown>;
  const rawTitle = typeof p.title === "string" ? p.title : "";
  const courseTitle = typeof p.courseTitle === "string" ? p.courseTitle : "";
  const summary =
    typeof p.summary === "string" ? p.summary : typeof p.message === "string" ? p.message : "";

  switch (notification.type) {
    case "course_published":
      return {
        title: rawTitle || (courseTitle ? `Course published: ${courseTitle}` : "Course published"),
        description:
          summary ||
          (courseTitle && rawTitle ? courseTitle : "A new course is available in the catalogue."),
      };
    case "lesson_published":
      return {
        title: rawTitle || "Lesson published",
        description:
          summary ||
          (courseTitle ? `New lesson added to ${courseTitle}` : "A new lesson is ready."),
      };
    case "enrollment_confirmed":
      return {
        title: rawTitle || "Enrollment confirmed",
        description:
          summary ||
          (courseTitle
            ? `You are enrolled in ${courseTitle}`
            : "Your course enrollment is confirmed."),
      };
    case "announcement_posted":
      return {
        title: rawTitle || "New announcement",
        description: summary || (courseTitle ? `Announcement in ${courseTitle}` : ""),
      };
    default:
      return {
        title: rawTitle || "Notification",
        description: summary || courseTitle,
      };
  }
}

export function NotificationTypeIcon({ type }: { type: string }) {
  const iconProps = { className: "h-4 w-4", "aria-hidden": true as const };
  switch (type) {
    case "course_published":
      return (
        <BookOpen
          {...iconProps}
          className="h-4 w-4 text-indigo-600 dark:text-indigo-400"
          data-testid="icon-course-published"
        />
      );
    case "lesson_published":
      return (
        <FileText
          {...iconProps}
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          data-testid="icon-lesson-published"
        />
      );
    case "enrollment_confirmed":
      return (
        <UserCheck
          {...iconProps}
          className="h-4 w-4 text-blue-600 dark:text-blue-400"
          data-testid="icon-enrollment-confirmed"
        />
      );
    case "announcement_posted":
      return (
        <Megaphone
          {...iconProps}
          className="h-4 w-4 text-amber-600 dark:text-amber-400"
          data-testid="icon-announcement-posted"
        />
      );
    default:
      return (
        <Bell
          {...iconProps}
          className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
          data-testid="icon-default"
        />
      );
  }
}

export function NotificationCenter({
  options,
  notificationState,
  defaultOpen = false,
  className = "",
}: NotificationCenterProps) {
  const router = useRouter();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const hookResult = useNotifications(options);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isConnected,
    isPolling = false,
  } = notificationState ?? hookResult;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);
    try {
      await markAllAsRead();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unreadCount, markAllAsRead]);

  const handleItemClick = useCallback(
    async (item: NotificationItem) => {
      if (!item.readAt) {
        try {
          await markAsRead(item.id);
        } catch (err) {
          console.error("Failed to mark notification as read:", err);
        }
      }
      const targetUrl = getNotificationUrl(item);
      if (targetUrl) router.push(targetUrl);
      setIsOpen(false);
    },
    [markAsRead, router],
  );

  return (
    <div className={`relative inline-flex ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white leading-none shadow-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10 z-50 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Notifications
              </h2>
              <div className="flex items-center gap-1.5" aria-live="polite">
                {isConnected && !isPolling ? (
                  <span
                    role="status"
                    className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                    title="Live connection active (SSE)"
                    aria-label="Connected (live)"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-medium">Live</span>
                  </span>
                ) : isPolling ? (
                  <span
                    role="status"
                    className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
                    title="Polling for updates"
                    aria-label="Connected (polling)"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    <span className="text-[11px] font-medium">Polling</span>
                  </span>
                ) : (
                  <span
                    role="status"
                    className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500"
                    title="Connecting"
                    aria-label="Connecting"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-400" />
                    </span>
                    <span className="text-[11px] font-medium">Connecting</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || isMarkingAll}
              className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Mark all as read
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Bell}
                title="No notifications yet"
                description="You're all caught up! New course updates and announcements will appear here."
                variant="plain"
                className="py-6"
              />
            </div>
          ) : (
            <ul
              className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/60"
              aria-live="polite"
            >
              {notifications.map((item) => {
                const isUnread = !item.readAt;
                const { title, description } = getNotificationContent(item);
                const relativeTime = formatRelativeTime(item.createdAt);

                return (
                  <li
                    key={item.id}
                    className={`relative flex items-start gap-3 p-3.5 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 ${
                      isUnread
                        ? "border-l-[3px] border-indigo-600 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20"
                        : "border-l-[3px] border-transparent"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                      <NotificationTypeIcon type={item.type} />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="min-w-0 flex-1 rounded p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`truncate text-xs leading-snug ${
                            isUnread
                              ? "font-semibold text-zinc-900 dark:text-zinc-100"
                              : "font-normal text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {title}
                        </p>
                        {relativeTime && (
                          <time
                            className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500"
                            dateTime={
                              item.createdAt ? new Date(item.createdAt).toISOString() : undefined
                            }
                          >
                            {relativeTime}
                          </time>
                        )}
                      </div>
                      {description && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {description}
                        </p>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5 self-center">
                      {isUnread && (
                        <>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400"
                            title="Unread"
                            aria-hidden="true"
                            data-testid="unread-dot"
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsRead(item.id);
                            }}
                            aria-label={`Mark "${title}" as read`}
                            title="Mark as read"
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
