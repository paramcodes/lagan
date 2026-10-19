import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../../../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: authMock.getSession,
    },
  },
}));

const queryMock = vi.hoisted(() => ({
  loadCourseBuilderData: vi.fn(),
}));

vi.mock("./query", () => ({
  loadCourseBuilderData: queryMock.loadCourseBuilderData,
}));

vi.mock("./course-outline-builder", () => ({
  CourseOutlineBuilder: ({ initialCourse }: { initialCourse: { title: string } }) => (
    <div data-testid="outline-builder">{initialCourse.title}</div>
  ),
}));

import CourseBuilderPage from "./page";

describe("CourseBuilderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when unauthenticated", async () => {
    authMock.getSession.mockResolvedValue(null);

    await CourseBuilderPage({
      params: Promise.resolve({ id: "c_1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/sign-in?callbackUrl=/teach/courses/c_1/builder");
  });

  it("calls notFound when course does not exist or author is not owner", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_1" } });
    queryMock.loadCourseBuilderData.mockResolvedValue(null);

    await CourseBuilderPage({
      params: Promise.resolve({ id: "c_999" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders course builder outline when course is found", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_1" } });
    queryMock.loadCourseBuilderData.mockResolvedValue({
      id: "c_1",
      title: "Building Microservices",
      description: null,
      priceCents: 4999,
      discountPercent: 0,
      isFree: false,
      status: "draft",
      authorId: "user_1",
      modules: [],
    });

    const page = await CourseBuilderPage({
      params: Promise.resolve({ id: "c_1" }),
    });
    render(page);
    expect(screen.getByTestId("outline-builder").textContent).toContain("Building Microservices");
  });
});
