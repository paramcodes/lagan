import type * as QueryModule from "./query";
import type { AuthorAnalyticsData } from "./types";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/teach/analytics",
}));

const queryMock = vi.hoisted(() => ({
  loadAuthorAnalyticsData: vi.fn<() => Promise<AuthorAnalyticsData>>(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  redirect: navigationMock.redirect,
  useRouter: navigationMock.useRouter,
  usePathname: navigationMock.usePathname,
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: authMock.getSession,
    },
  },
}));

vi.mock("./query", async (importOriginal) => {
  const actual = await importOriginal<typeof QueryModule>();
  return {
    ...actual,
    loadAuthorAnalyticsData: queryMock.loadAuthorAnalyticsData,
  };
});

import AnalyticsPage from "./page";

describe("AnalyticsPage", () => {
  const USER_ID = "instructor_123";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getSession.mockResolvedValue({
      user: { id: USER_ID, role: "instructor" },
    });
  });

  it("redirects unauthenticated users to sign-in with callbackUrl", async () => {
    authMock.getSession.mockResolvedValueOnce(null);

    await AnalyticsPage({
      searchParams: Promise.resolve({}),
    });

    expect(navigationMock.redirect).toHaveBeenCalledWith("/sign-in?callbackUrl=/teach/analytics");
  });

  it("redirects users with non-instructor roles to /learn", async () => {
    authMock.getSession.mockResolvedValueOnce({
      user: { id: "student_1", role: "student" },
    });

    await AnalyticsPage({
      searchParams: Promise.resolve({}),
    });

    expect(navigationMock.redirect).toHaveBeenCalledWith("/learn");
  });

  it("renders EmptyState when author has no courses", async () => {
    queryMock.loadAuthorAnalyticsData.mockResolvedValueOnce({
      courses: [],
      selectedCourse: null,
      selectedCourseId: null,
      chartCourse: null,
      selectedRange: "30d",
      overview: {
        totalEnrolments: 0,
        starts: 0,
        completions: 0,
        dropOffs: 0,
        completionRate: 0,
      },
      trendPoints: [],
      dropoffPoints: [],
      hasNoEvents: true,
      dateWindow: {},
    });

    const page = await AnalyticsPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("No courses created yet")).toBeDefined();
    expect(screen.getByText(/Create and publish a course to start tracking/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to Courses" })).toBeDefined();
  });

  it("renders zero overview cards and empty-events state when author has courses but no events", async () => {
    queryMock.loadAuthorAnalyticsData.mockResolvedValueOnce({
      courses: [
        {
          id: "c_1",
          title: "Introduction to Rust",
          status: "published",
          metrics: {
            courseId: "c_1",
            enrolments: 0,
            totalEnrolments: 0,
            starts: 0,
            completions: 0,
            dropOffs: 0,
            completionRate: 0,
          },
        },
      ],
      selectedCourse: null,
      selectedCourseId: null,
      chartCourse: null,
      selectedRange: "30d",
      overview: {
        totalEnrolments: 0,
        starts: 0,
        completions: 0,
        dropOffs: 0,
        completionRate: 0,
      },
      trendPoints: [],
      dropoffPoints: [],
      hasNoEvents: true,
      dateWindow: {},
    });

    const page = await AnalyticsPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("Course Analytics")).toBeDefined();
    expect(screen.getByText("Tracking performance across 1 course")).toBeDefined();
    expect(screen.getByText("No analytics recorded")).toBeDefined();
    expect(screen.getByTestId("metric-total-enrolments")).toBeDefined();
    expect(screen.getByTestId("metric-course-starts")).toBeDefined();
    expect(screen.getByTestId("metric-completions")).toBeDefined();
    expect(screen.getByTestId("metric-completion-rate")).toBeDefined();
  });

  it("renders full dashboard with overview metrics, charts, and course table when activity exists", async () => {
    queryMock.loadAuthorAnalyticsData.mockResolvedValueOnce({
      courses: [
        {
          id: "c_1",
          title: "Distributed Systems in Practice",
          status: "published",
          metrics: {
            courseId: "c_1",
            enrolments: 120,
            totalEnrolments: 120,
            starts: 100,
            completions: 65,
            dropOffs: 20,
            completionRate: 0.65,
          },
        },
      ],
      selectedCourse: null,
      selectedCourseId: null,
      chartCourse: {
        id: "c_1",
        title: "Distributed Systems in Practice",
        status: "published",
        metrics: {
          courseId: "c_1",
          enrolments: 120,
          totalEnrolments: 120,
          starts: 100,
          completions: 65,
          dropOffs: 20,
          completionRate: 0.65,
        },
      },
      selectedRange: "30d",
      overview: {
        totalEnrolments: 120,
        starts: 100,
        completions: 65,
        dropOffs: 20,
        completionRate: 0.65,
      },
      trendPoints: [
        { label: "Oct 1", value: 40, secondaryValue: 35 },
        { label: "Oct 8", value: 80, secondaryValue: 65 },
      ],
      dropoffPoints: [
        {
          lessonId: "l_1",
          lessonTitle: "1. Consensus Basics",
          completedCount: 90,
          startedCount: 100,
          droppedCount: 10,
          dropoffRate: 0.1,
          order: 1,
        },
      ],
      hasNoEvents: false,
      dateWindow: {},
    });

    const page = await AnalyticsPage({
      searchParams: Promise.resolve({ range: "30d" }),
    });
    render(page);

    expect(screen.getByText("Course Analytics")).toBeDefined();
    expect(screen.getByTestId("metric-total-enrolments").textContent).toContain("120");
    expect(screen.getByTestId("metric-course-starts").textContent).toContain("100");
    expect(screen.getByTestId("metric-completions").textContent).toContain("65");
    expect(screen.getByTestId("metric-completion-rate").textContent).toContain("65.0%");

    expect(screen.getByTestId("trend-chart-container")).toBeDefined();
    expect(screen.getByTestId("dropoff-chart-container")).toBeDefined();

    expect(screen.getAllByText("Distributed Systems in Practice").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("navigation", { name: "Date range filter" })).toBeDefined();
  });
});
