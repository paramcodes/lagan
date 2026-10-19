vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

const redirectMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/learn",
}));

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));
vi.mock("../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: authMock.getSession,
    },
  },
}));

const queryMock = vi.hoisted(() => ({
  listEnrolledCourses: vi.fn(),
}));
vi.mock("./query", () => ({
  listEnrolledCourses: queryMock.listEnrolledCourses,
}));

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnDashboardPage from "./page";

describe("LearnDashboardPage", () => {
  const USER_ID = "usr_alice";

  const sampleCourses = [
    {
      id: "course_distributed",
      title: "Distributed Systems in Practice",
      description: "Build fault-tolerant services",
      authorName: "Dr. Evelyn Reed",
      tenantId: "default",
      enrolledAt: new Date("2026-03-01T10:00:00Z"),
      progress: {
        courseId: "course_distributed",
        totalLessons: 10,
        completedLessons: 6,
        percent: 60,
        formatted: "6 of 10 lessons",
        isCompleted: false,
      },
      resumeHref: "/courses/course_distributed/lessons/les_7",
      resumeLessonId: "les_7",
      resumeLessonTitle: "Raft State Machine Safety",
      actionLabel: "Continue Learning",
    },
    {
      id: "course_typescript",
      title: "Type-Driven Architecture with TypeScript",
      description: "Type-level programming",
      authorName: "Dr. Evelyn Reed",
      tenantId: "default",
      enrolledAt: new Date("2026-03-02T10:00:00Z"),
      progress: {
        courseId: "course_typescript",
        totalLessons: 5,
        completedLessons: 5,
        percent: 100,
        formatted: "5 of 5 lessons",
        isCompleted: true,
      },
      resumeHref: "/courses/course_typescript/lessons/les_ts1",
      resumeLessonId: "les_ts1",
      resumeLessonTitle: "Brand Types & Invariants",
      actionLabel: "Review Course",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when user is unauthenticated", async () => {
    authMock.getSession.mockResolvedValue(null);

    await LearnDashboardPage({
      searchParams: Promise.resolve({}),
    });

    expect(redirectMock).toHaveBeenCalledWith("/sign-in?next=/learn");
  });

  it("renders EmptyState primitive with link to /courses catalogue when learner has no enrolled courses", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: USER_ID } });
    queryMock.listEnrolledCourses.mockResolvedValue([]);

    const page = await LearnDashboardPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("No enrolled courses yet")).toBeTruthy();
    expect(
      screen.getByText(/You haven't enrolled in any courses yet/i),
    ).toBeTruthy();

    const browseLink = screen.getByRole("link", { name: "Browse Courses" });
    expect(browseLink).toBeTruthy();
    expect(browseLink.getAttribute("href")).toBe("/courses");

    expect(screen.getByText("No enrolled courses")).toBeTruthy();
  });

  it("renders enrolled courses in cards view by default with progress bar and continue deep link", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: USER_ID } });
    queryMock.listEnrolledCourses.mockResolvedValue(sampleCourses);

    const page = await LearnDashboardPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("2 enrolled courses")).toBeTruthy();

    // Verify course 1
    expect(screen.getByText("Distributed Systems in Practice")).toBeTruthy();
    expect(screen.getByText("60% completed")).toBeTruthy();
    expect(screen.getByText("6 of 10 lessons")).toBeTruthy();
    expect(screen.getByText("Raft State Machine Safety")).toBeTruthy();

    // Verify progress bars
    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(2);
    expect(progressbars[0]?.getAttribute("aria-valuenow")).toBe("60");
    expect(progressbars[0]?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbars[0]?.getAttribute("aria-valuemax")).toBe("100");

    // Verify course 2 (completed)
    expect(
      screen.getByText("Type-Driven Architecture with TypeScript"),
    ).toBeTruthy();
    expect(screen.getByText("100% completed")).toBeTruthy();
    expect(screen.getByText("5 of 5 lessons")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();

    // Verify direct "Continue Learning" action buttons and deep links
    const continueLinks = screen.getAllByRole("link", {
      name: /continue learning/i,
    });
    expect(continueLinks).toHaveLength(2);
    expect(continueLinks[0]?.getAttribute("href")).toBe(
      "/courses/course_distributed/lessons/les_7",
    );
    expect(continueLinks[1]?.getAttribute("href")).toBe(
      "/courses/course_typescript/lessons/les_ts1",
    );

    // ViewToggle is present with Cards active
    expect(
      screen.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("renders enrolled courses in ledger list view when view=ledger", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: USER_ID } });
    queryMock.listEnrolledCourses.mockResolvedValue(sampleCourses);

    const page = await LearnDashboardPage({
      searchParams: Promise.resolve({ view: "ledger" }),
    });
    render(page);

    expect(screen.getByText("Distributed Systems in Practice")).toBeTruthy();
    expect(
      screen.getByText("Type-Driven Architecture with TypeScript"),
    ).toBeTruthy();

    // Verify view toggle indicates List is pressed
    expect(
      screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed"),
    ).toBe("true");

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(2);

    const continueLinks = screen.getAllByRole("link", {
      name: /continue learning/i,
    });
    expect(continueLinks).toHaveLength(2);
    expect(continueLinks[0]?.getAttribute("href")).toBe(
      "/courses/course_distributed/lessons/les_7",
    );
  });
});
