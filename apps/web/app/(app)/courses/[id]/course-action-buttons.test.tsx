import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CourseActionButtons } from "./course-action-buttons";

const actionsMock = vi.hoisted(() => ({
  enrollFreeCourse: vi.fn(),
}));

vi.mock("./actions", () => ({
  enrollFreeCourse: actionsMock.enrollFreeCourse,
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe("CourseActionButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Enrolled state", () => {
    it("renders Continue Learning link to resume lesson", () => {
      render(
        <CourseActionButtons
          courseId="course_1"
          isEnrolled={true}
          resumeHref="/courses/course_1/lessons/les_3"
          isFree={false}
          priceCents={4999}
          isAuthenticated={true}
        />,
      );

      const link = screen.getByRole("link", { name: /continue learning/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/courses/course_1/lessons/les_3");
      expect(screen.getByTestId("continue-learning-button")).toBeTruthy();
    });
  });

  describe("Free course state", () => {
    it("renders link to sign-in with prompt when unauthenticated", () => {
      render(
        <CourseActionButtons
          courseId="course_free"
          isEnrolled={false}
          resumeHref="/courses/course_free/lessons/les_1"
          isFree={true}
          priceCents={0}
          isAuthenticated={false}
        />,
      );

      const enrollButton = screen.getByRole("link", { name: /enroll for free/i });
      expect(enrollButton).toBeTruthy();
      expect(enrollButton.getAttribute("href")).toBe("/sign-in?next=%2Fcourses%2Fcourse_free");
      expect(screen.getByText(/sign in to enroll/i)).toBeTruthy();
    });

    it("renders button and calls enrollFreeCourse when authenticated", async () => {
      actionsMock.enrollFreeCourse.mockResolvedValueOnce({ success: true });

      render(
        <CourseActionButtons
          courseId="course_free"
          isEnrolled={false}
          resumeHref="/courses/course_free/lessons/les_1"
          isFree={true}
          priceCents={0}
          isAuthenticated={true}
        />,
      );

      const enrollButton = screen.getByRole("button", { name: /enroll for free/i });
      expect(enrollButton).toBeTruthy();

      fireEvent.click(enrollButton);

      await waitFor(() => {
        expect(actionsMock.enrollFreeCourse).toHaveBeenCalledWith("course_free");
        expect(pushMock).toHaveBeenCalledWith("/courses/course_free/lessons/les_1");
        expect(refreshMock).toHaveBeenCalled();
      });
    });

    it("displays error alert when free enrollment fails", async () => {
      actionsMock.enrollFreeCourse.mockRejectedValueOnce(new Error("Database error"));

      render(
        <CourseActionButtons
          courseId="course_free"
          isEnrolled={false}
          resumeHref="/courses/course_free/lessons/les_1"
          isFree={true}
          priceCents={0}
          isAuthenticated={true}
        />,
      );

      const enrollButton = screen.getByRole("button", { name: /enroll for free/i });
      fireEvent.click(enrollButton);

      await waitFor(() => {
        expect(screen.getByRole("alert").textContent).toContain("Database error");
      });
    });
  });

  describe("Paid course state", () => {
    it("renders link to sign-in with prompt when unauthenticated", () => {
      render(
        <CourseActionButtons
          courseId="course_paid"
          isEnrolled={false}
          resumeHref="/courses/course_paid/lessons/les_1"
          isFree={false}
          priceCents={4999}
          isAuthenticated={false}
        />,
      );

      const buyButton = screen.getByRole("link", { name: /buy now/i });
      expect(buyButton).toBeTruthy();
      expect(buyButton.getAttribute("href")).toBe("/sign-in?next=%2Fcourses%2Fcourse_paid");
      expect(screen.getByText(/sign in to buy/i)).toBeTruthy();
    });

    it("renders Buy Now button and initiates checkout when authenticated", async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, href: "" },
        writable: true,
        configurable: true,
      });
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ url: "https://checkout.stripe.com/pay/cs_test_123" }),
      });
      globalThis.fetch = fetchMock;

      render(
        <CourseActionButtons
          courseId="course_paid"
          isEnrolled={false}
          resumeHref="/courses/course_paid/lessons/les_1"
          isFree={false}
          priceCents={4999}
          isAuthenticated={true}
        />,
      );

      const buyButton = screen.getByRole("button", { name: /buy now/i });
      expect(buyButton).toBeTruthy();

      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: "course_paid" }),
        });
        expect(window.location.href).toBe("https://checkout.stripe.com/pay/cs_test_123");
      });

      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it("displays error alert when checkout API fails", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Stripe connection failed" }),
      });
      globalThis.fetch = fetchMock;

      render(
        <CourseActionButtons
          courseId="course_paid"
          isEnrolled={false}
          resumeHref="/courses/course_paid/lessons/les_1"
          isFree={false}
          priceCents={4999}
          isAuthenticated={true}
        />,
      );

      const buyButton = screen.getByRole("button", { name: /buy now/i });
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(screen.getByRole("alert").textContent).toContain("Stripe connection failed");
      });
    });
  });
});
