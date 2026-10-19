import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseDetailData } from "./query";

const notFoundMock = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSession } },
}));
const queryMock = vi.hoisted(() => ({
  getCourseDetail: vi.fn(),
  getResumeLessonForCourse: vi.fn(),
  checkCourseAccess: vi.fn(),
}));

vi.mock("./query", () => ({
  getCourseDetail: queryMock.getCourseDetail,
  getResumeLessonForCourse: queryMock.getResumeLessonForCourse,
  checkCourseAccess: queryMock.checkCourseAccess,
}));

import CourseDetailPage, { generateMetadata } from "./page";
const sampleCourse: CourseDetailData = {
  id: "course_1",
  tenantId: "default",
  title: "Building Distributed Services",
  description: "A comprehensive deep dive into distributed systems engineering.",
  priceCents: 4999,
  discountPercent: 20,
  isFree: false,
  status: "published",
  version: 1,
  publishedAt: new Date("2026-03-01T00:00:00Z"),
  instructor: {
    id: "author_1",
    name: "Dr. Evelyn Reed",
    bio: "Senior distributed systems researcher and architect.",
    avatarUrl: "https://example.com/evelyn.jpg",
    websiteUrl: "https://evelynreed.com",
  },
  modules: [
    {
      id: "mod_1",
      courseId: "course_1",
      title: "Consensus Algorithms",
      position: 0,
      lessons: [
        {
          id: "les_1",
          moduleId: "mod_1",
          title: "Introduction to Raft",
          type: "video",
          position: 0,
          duration: "12 min",
          isPreview: true,
        },
      ],
    },
  ],
  totalLessons: 1,
  totalDuration: "12 min",
};

describe("CourseDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryMock.checkCourseAccess.mockResolvedValue(false);
    authMock.getSession.mockResolvedValue(null);
  });

  describe("404 handling", () => {
    it("calls notFound when course does not exist", async () => {
      queryMock.getCourseDetail.mockResolvedValueOnce(null);

      await CourseDetailPage({
        params: Promise.resolve({ id: "missing" }),
        searchParams: Promise.resolve({}),
      });

      expect(notFoundMock).toHaveBeenCalled();
    });
  });

  describe("Metadata generation", () => {
    it("returns course title and description when course is found", async () => {
      queryMock.getCourseDetail.mockResolvedValueOnce(sampleCourse);

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: "course_1" }),
      });

      expect(metadata.title).toBe("Building Distributed Services | Lagan");
      expect(metadata.description).toBe(sampleCourse.description);
    });

    it("returns fallback title when course is missing", async () => {
      queryMock.getCourseDetail.mockResolvedValueOnce(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: "missing" }),
      });

      expect(metadata.title).toBe("Course not found | Lagan");
    });
  });

  describe("Rendering course content", () => {
    it("renders course header, cover, instructor card, price, and syllabus outline", async () => {
      queryMock.getCourseDetail.mockResolvedValue(sampleCourse);

      const page = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      // Title & description
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "Building Distributed Services",
      );
      expect(
        screen.getByText("A comprehensive deep dive into distributed systems engineering."),
      ).toBeTruthy();

      // Cover
      expect(screen.getByTestId("course-cover")).toBeTruthy();

      // Instructor
      const instructorCard = screen.getByTestId("instructor-card");
      expect(instructorCard.textContent).toContain("Dr. Evelyn Reed");
      expect(instructorCard.textContent).toContain(
        "Senior distributed systems researcher and architect.",
      );

      // Price: 4999 with 20% discount -> $39.99, original $49.99
      const priceElement = screen.getByTestId("course-price");
      expect(priceElement.textContent).toContain("$39.99");
      expect(screen.getByText("$49.99")).toBeTruthy();
      expect(screen.getByText("20% OFF")).toBeTruthy();

      // Syllabus
      expect(screen.getByText("Curriculum Syllabus")).toBeTruthy();
      expect(screen.getByText("Consensus Algorithms")).toBeTruthy();
      expect(screen.getByText("Introduction to Raft")).toBeTruthy();
    });

    it("renders Continue Learning link when user is already enrolled", async () => {
      queryMock.getCourseDetail.mockResolvedValue(sampleCourse);
      authMock.getSession.mockResolvedValue({ user: { id: "user_learner" } });
      queryMock.checkCourseAccess.mockResolvedValue(true);
      queryMock.getResumeLessonForCourse.mockResolvedValue({
        resumeLessonId: "les_1",
        resumeHref: "/courses/course_1/lessons/les_1",
      });

      const page = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      const continueBtn = screen.getByRole("link", { name: /continue learning/i });
      expect(continueBtn).toBeTruthy();
      expect(continueBtn.getAttribute("href")).toBe("/courses/course_1/lessons/les_1");
    });

    it("renders Enroll for Free when course is free", async () => {
      const freeCourse: CourseDetailData = {
        ...sampleCourse,
        id: "course_free",
        priceCents: 0,
        discountPercent: 0,
        isFree: true,
      };

      queryMock.getCourseDetail.mockResolvedValue(freeCourse);
      authMock.getSession.mockResolvedValue({ user: { id: "user_learner" } });

      const page = await CourseDetailPage({
        params: Promise.resolve({ id: "course_free" }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      expect(screen.getByRole("button", { name: /enroll for free/i })).toBeTruthy();
      expect(screen.getByTestId("course-price").textContent).toContain("Free");
    });

    it("renders Buy Now when course is paid and user is not enrolled", async () => {
      queryMock.getCourseDetail.mockResolvedValue(sampleCourse);
      authMock.getSession.mockResolvedValue({ user: { id: "user_learner" } });

      const page = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      expect(screen.getByRole("button", { name: /buy now/i })).toBeTruthy();
    });

    it("renders sign-in prompt for signed-out users", async () => {
      queryMock.getCourseDetail.mockResolvedValue(sampleCourse);

      const page = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      expect(screen.getByText(/sign in to buy/i)).toBeTruthy();
    });

    it("renders checkout success and cancelled alert banners", async () => {
      queryMock.getCourseDetail.mockResolvedValue(sampleCourse);
      authMock.getSession.mockResolvedValue(null);
      queryMock.checkCourseAccess.mockResolvedValue(false);

      // Success
      const successPage = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({ checkout: "success" }),
      });
      const { unmount } = render(successPage);
      expect(screen.getByText(/payment successful/i)).toBeTruthy();
      unmount();

      // Cancelled
      const cancelledPage = await CourseDetailPage({
        params: Promise.resolve({ id: "course_1" }),
        searchParams: Promise.resolve({ checkout: "cancelled" }),
      });
      render(cancelledPage);
      expect(screen.getByText(/checkout was cancelled/i)).toBeTruthy();
    });
  });
});
