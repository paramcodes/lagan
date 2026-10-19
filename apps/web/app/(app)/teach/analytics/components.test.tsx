import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseSelector } from "./course-selector";
import { CoursesMetricsTable } from "./courses-metrics-table";
import { DateRangeFilter } from "./date-range-filter";
import { OverviewCards } from "./overview-cards";
import type { CourseSummaryItem } from "./types";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/teach/analytics",
}));

describe("Analytics Supporting Components", () => {
  describe("OverviewCards", () => {
    it("renders all 4 cards with non-zero metrics", () => {
      render(
        <OverviewCards
          overview={{
            totalEnrolments: 1250,
            starts: 800,
            completions: 480,
            dropOffs: 150,
            completionRate: 0.6,
          }}
        />,
      );

      expect(screen.getByTestId("metric-total-enrolments").textContent).toContain("1,250");
      expect(screen.getByTestId("metric-course-starts").textContent).toContain("800");
      expect(screen.getByTestId("metric-completions").textContent).toContain("480");
      expect(screen.getByTestId("metric-completion-rate").textContent).toContain("60.0%");
    });

    it("renders zero values cleanly without NaN", () => {
      render(
        <OverviewCards
          overview={{
            totalEnrolments: 0,
            starts: 0,
            completions: 0,
            dropOffs: 0,
            completionRate: 0,
          }}
        />,
      );

      expect(screen.getByTestId("metric-total-enrolments").textContent).toContain("0");
      expect(screen.getByTestId("metric-completion-rate").textContent).toContain("0.0%");
    });
  });

  describe("DateRangeFilter", () => {
    it("marks active range with aria-current", () => {
      render(<DateRangeFilter currentRange="7d" />);

      const activeLink = screen.getByRole("link", { name: "Filter by 7 days" });
      expect(activeLink.getAttribute("aria-current")).toBe("page");

      const inactiveLink = screen.getByRole("link", { name: "Filter by 30 days" });
      expect(inactiveLink.getAttribute("aria-current")).toBeNull();
    });

    it("preserves courseId in href query parameter", () => {
      render(<DateRangeFilter currentRange="30d" courseId="c_999" />);

      const link = screen.getByRole("link", { name: "Filter by 90 days" });
      expect(link.getAttribute("href")).toBe("/teach/analytics?range=90d&courseId=c_999");
    });
  });

  describe("CourseSelector", () => {
    const mockCourses: CourseSummaryItem[] = [
      {
        id: "c_1",
        title: "Course Alpha",
        status: "published",
        metrics: {
          courseId: "c_1",
          enrolments: 10,
          totalEnrolments: 10,
          starts: 5,
          completions: 2,
          dropOffs: 1,
          completionRate: 0.4,
        },
      },
      {
        id: "c_2",
        title: "Course Beta",
        status: "draft",
        metrics: {
          courseId: "c_2",
          enrolments: 0,
          totalEnrolments: 0,
          starts: 0,
          completions: 0,
          dropOffs: 0,
          completionRate: 0,
        },
      },
    ];

    it("returns null when courses list is empty", () => {
      const { container } = render(
        <CourseSelector courses={[]} selectedCourseId={null} currentRange="30d" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders options and triggers router.push on change", () => {
      render(<CourseSelector courses={mockCourses} selectedCourseId="c_1" currentRange="7d" />);

      const select = screen.getByRole("combobox", {
        name: "Filter analytics by course",
      });
      expect(select).toBeDefined();

      fireEvent.change(select, { target: { value: "c_2" } });
      expect(mockRouter.push).toHaveBeenCalledWith("/teach/analytics?range=7d&courseId=c_2");
    });

    it("clears courseId query parameter when 'all' is selected", () => {
      render(<CourseSelector courses={mockCourses} selectedCourseId="c_1" currentRange="30d" />);

      const select = screen.getByRole("combobox", {
        name: "Filter analytics by course",
      });
      fireEvent.change(select, { target: { value: "all" } });
      expect(mockRouter.push).toHaveBeenCalledWith("/teach/analytics");
    });
  });

  describe("CoursesMetricsTable", () => {
    const mockCourses: CourseSummaryItem[] = [
      {
        id: "c_1",
        title: "Course Alpha",
        status: "published",
        metrics: {
          courseId: "c_1",
          enrolments: 50,
          totalEnrolments: 50,
          starts: 40,
          completions: 30,
          dropOffs: 5,
          completionRate: 0.75,
        },
      },
    ];

    it("renders table with course rows and metrics", () => {
      render(
        <CoursesMetricsTable courses={mockCourses} selectedCourseId={null} currentRange="30d" />,
      );

      expect(screen.getByText("Course Performance Breakdown")).toBeDefined();
      expect(screen.getByText("Course Alpha")).toBeDefined();
      expect(screen.getByText("50")).toBeDefined();
      expect(screen.getByText("40")).toBeDefined();
      expect(screen.getByText("30")).toBeDefined();
      expect(screen.getByText("75.0%")).toBeDefined();
      expect(screen.getByRole("link", { name: "Filter" })).toBeDefined();
    });

    it("shows 'Selected' when course is currently filtered", () => {
      render(
        <CoursesMetricsTable courses={mockCourses} selectedCourseId="c_1" currentRange="30d" />,
      );

      expect(screen.getByRole("link", { name: "Selected" })).toBeDefined();
    });

    it("returns null when courses list is empty", () => {
      const { container } = render(
        <CoursesMetricsTable courses={[]} selectedCourseId={null} currentRange="30d" />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
