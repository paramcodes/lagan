import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BarChart,
  ChartCard,
  LessonDropoffBarChart,
  TrendLineChart,
} from "./charts";

describe("TrendLineChart", () => {
  const sampleData = [
    { label: "Mon", value: 12 },
    { label: "Tue", value: 24 },
    { label: "Wed", value: 18 },
    { label: "Thu", value: 36 },
  ];

  it("renders trend line and data points from metrics", () => {
    const { container } = render(
      <TrendLineChart
        title="Weekly Enrollments"
        description="Daily new student enrollments"
        data={sampleData}
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Weekly Enrollments");

    // Grid lines, line path, area path, circles
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThanOrEqual(1);

    const circles = container.querySelectorAll("svg circle");
    expect(circles).toHaveLength(4);

    expect(screen.getByText("Weekly Enrollments")).toBeInTheDocument();
    expect(screen.getByText("Daily new student enrollments")).toBeInTheDocument();
  });

  it("includes an accessible semantic data table fallback", () => {
    render(
      <TrendLineChart
        title="Completion Trend"
        data={sampleData}
        tableCaption="Table of completions over time"
      />
    );

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Table of completions over time")).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Point / Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();

    const cells = screen.getAllByRole("cell");
    expect(cells.some((c) => c.textContent === "Mon")).toBe(true);
    expect(cells.some((c) => c.textContent === "36")).toBe(true);
  });

  it("renders an accessible text summary for screen readers", () => {
    render(
      <TrendLineChart
        title="Student Activity"
        data={sampleData}
        summary="Custom summary: Enrollments peaked on Thursday."
      />
    );

    expect(
      screen.getByText("Custom summary: Enrollments peaked on Thursday.")
    ).toBeInTheDocument();
  });

  it("handles empty data gracefully with accessible fallback", () => {
    render(
      <TrendLineChart
        title="Empty Metrics"
        data={[]}
        emptyMessage="No activity recorded yet"
      />
    );

    expect(screen.getAllByText("No activity recorded yet").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("handles edge cases: single data point and flat line", () => {
    const single = render(
      <TrendLineChart title="Single Point" data={[{ label: "Only", value: 42 }]} />
    );
    expect(single.container.querySelector("svg")).toBeInTheDocument();

    const flat = render(
      <TrendLineChart
        title="Flat Line"
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 10 },
        ]}
      />
    );
    expect(flat.container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies DTCG tokens and allows overriding them", () => {
    const { container } = render(
      <TrendLineChart
        title="Token Themed"
        data={sampleData}
        themeTokens={{ "--color-accent": "var(--color-chalk)" }}
      />
    );

    const section = container.querySelector("section");
    expect(section?.style.getPropertyValue("--color-accent")).toBe("var(--color-chalk)");
    expect(section?.style.getPropertyValue("--color-line")).toBe("var(--color-line, #E0E1DE)");
  });

  it("formats values using a custom valueFormatter", () => {
    render(
      <TrendLineChart
        data={sampleData}
        valueFormatter={(v) => `$${v}.00`}
      />
    );

    const cells = screen.getAllByRole("cell");
    expect(cells.some((c) => c.textContent === "$36.00")).toBe(true);
  });
});

describe("LessonDropoffBarChart", () => {
  const lessonData = [
    {
      lessonTitle: "1. Introduction to Databases",
      startedCount: 100,
      completedCount: 95,
      droppedCount: 5,
    },
    {
      lessonTitle: "2. Schema Design",
      startedCount: 95,
      completedCount: 80,
      droppedCount: 15,
    },
    {
      lessonTitle: "3. Advanced Migrations",
      startedCount: 80,
      completedCount: 48,
      droppedCount: 32,
    },
  ];

  it("renders horizontal bars with lesson titles and dropoff rates", () => {
    const { container } = render(
      <LessonDropoffBarChart
        title="Per-Lesson Drop-Off"
        data={lessonData}
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("role")).toBe("img");

    // Horizontal bars
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(6); // tracks + completed bars

    // Titles or truncated titles
    expect(container.textContent).toContain("1. Introduction to");
    expect(container.textContent).toContain("3. Advanced Migrat");
  });

  it("renders an accessible table with lesson drop-off figures", () => {
    render(<LessonDropoffBarChart data={lessonData} />);

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Lesson" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Started" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Drop-offs" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Drop-off Rate" })).toBeInTheDocument();

    const cells = screen.getAllByRole("cell");
    expect(cells.some((c) => c.textContent === "1. Introduction to Databases")).toBe(true);
    expect(cells.some((c) => c.textContent === "40.0%")).toBe(true); // 32/80 = 40%
  });

  it("identifies highest drop-off in auto-generated summary", () => {
    render(<LessonDropoffBarChart data={lessonData} />);

    const summary = screen.getByText(/Highest drop-off is at 3\. Advanced Migrations/);
    expect(summary).toBeInTheDocument();
  });

  it("calculates started and dropped counts automatically when omitted", () => {
    const minimal = [
      { lessonTitle: "Intro", completedCount: 50, droppedCount: 10 },
      { lessonTitle: "Advanced", completedCount: 30, droppedCount: 20 },
    ];

    render(<LessonDropoffBarChart data={minimal} />);

    const cells = screen.getAllByRole("cell");
    expect(cells.some((c) => c.textContent === "60")).toBe(true); // 50 + 10 started
    expect(cells.some((c) => c.textContent === "16.7%")).toBe(true); // 10/60
  });

  it("supports vertical orientation", () => {
    const { container } = render(
      <LessonDropoffBarChart data={lessonData} orientation="vertical" />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders empty state when no lesson metrics exist", () => {
    render(
      <LessonDropoffBarChart
        data={[]}
        emptyMessage="No lesson drop-off metrics yet"
      />
    );

    expect(screen.getAllByText("No lesson drop-off metrics yet").length).toBeGreaterThanOrEqual(1);
  });
});

describe("BarChart", () => {
  const categories = [
    { label: "Course A", value: 120 },
    { label: "Course B", value: 340 },
    { label: "Course C", value: 210 },
  ];

  it("renders vertical bars and accessible table", () => {
    const { container } = render(
      <BarChart title="Courses by Enrollment" data={categories} />
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
  });

  it("renders horizontal bars when requested", () => {
    const { container } = render(
      <BarChart data={categories} orientation="horizontal" />
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Course B");
  });
});

describe("AccessibleChartContainer interactions", () => {
  it("allows toggling visible data table when showTableToggle is enabled", () => {
    render(
      <TrendLineChart
        title="Toggleable Table"
        data={[{ label: "Jan", value: 5 }]}
        showTableToggle={true}
      />
    );

    const toggleButton = screen.getByRole("button", { name: "View data table" });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByRole("button", { name: "Hide data table" })).toBeInTheDocument();
  });
});

describe("ChartCard", () => {
  it("renders title, description, metric stat and chart child", () => {
    render(
      <ChartCard
        title="Total Learners"
        description="Active learners in current cohort"
        metric="1,420"
        metricLabel="+12% from last month"
      >
        <div data-testid="chart-content">Chart Body</div>
      </ChartCard>
    );

    expect(screen.getByText("Total Learners")).toBeInTheDocument();
    expect(screen.getByText("Active learners in current cohort")).toBeInTheDocument();
    expect(screen.getByText("1,420")).toBeInTheDocument();
    expect(screen.getByText("+12% from last month")).toBeInTheDocument();
    expect(screen.getByTestId("chart-content")).toBeInTheDocument();
  });
});
