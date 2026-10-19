vi.mock("@mux/mux-player-react", () => ({ default: () => null }));
vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

const mockCoursesResult = vi.hoisted(() => ({
  rows: [
    {
      id: "course_1",
      title: "Rust for Beginners",
      authorName: "Alice",
      priceCents: 2999,
      discountPercent: 0,
      isFree: false,
    },
    {
      id: "course_2",
      title: "Advanced TypeScript",
      authorName: "Bob",
      priceCents: 0,
      discountPercent: 0,
      isFree: true,
    },
  ],
  total: 2,
  page: 1,
  pageCount: 1,
}));

vi.mock("./query", () => ({
  listPublishedCourses: vi.fn(async () => mockCoursesResult),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/courses",
}));

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CoursesPage from "./page";

describe("CoursesPage", () => {
  it("renders published courses in cards view by default", async () => {
    const page = await CoursesPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("Rust for Beginners")).toBeTruthy();
    expect(screen.getByText("Advanced TypeScript")).toBeTruthy();
    expect(screen.getByText("2 published courses")).toBeTruthy();
  });

  it("renders published courses in ledger view when view=ledger", async () => {
    const page = await CoursesPage({
      searchParams: Promise.resolve({ view: "ledger" }),
    });
    render(page);

    expect(screen.getByText("Rust for Beginners")).toBeTruthy();
    expect(screen.getByText("Advanced TypeScript")).toBeTruthy();
  });

  it("renders empty state with clear filters link when search matches nothing", async () => {
    mockCoursesResult.rows = [];
    mockCoursesResult.total = 0;
    mockCoursesResult.pageCount = 1;

    const page = await CoursesPage({
      searchParams: Promise.resolve({ q: "nonexistent" }),
    });
    render(page);

    expect(screen.getByText("No courses match your search")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("renders empty state without clear filters when no courses exist", async () => {
    mockCoursesResult.rows = [];
    mockCoursesResult.total = 0;
    mockCoursesResult.pageCount = 1;

    const page = await CoursesPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("No courses published yet")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("renders pagination navigation when pageCount > 1", async () => {
    mockCoursesResult.rows = [
      {
        id: "course_1",
        title: "Rust for Beginners",
        authorName: "Alice",
        priceCents: 2999,
        discountPercent: 0,
        isFree: false,
      },
    ];
    mockCoursesResult.total = 25;
    mockCoursesResult.pageCount = 3;
    mockCoursesResult.page = 2;

    const page = await CoursesPage({
      searchParams: Promise.resolve({ page: "2" }),
    });
    render(page);

    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    expect(pagination).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("renders category note when category filter is selected", async () => {
    const page = await CoursesPage({
      searchParams: Promise.resolve({ category: "design" }),
    });
    render(page);

    expect(screen.getByRole("status")).toBeTruthy();
  });
});
