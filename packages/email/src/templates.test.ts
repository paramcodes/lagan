import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderCourseEnrollmentEmail,
  renderLessonCompleteEmail,
  renderNewContentPublishedEmail,
  renderNotificationTemplate,
  renderWelcomeEmail,
} from "./templates";

describe("Email Templates", () => {
  describe("escapeHtml", () => {
    it("escapes special HTML characters", () => {
      const raw = `<script>alert("xss & 'danger'");</script>`;
      const escaped = escapeHtml(raw);
      expect(escaped).toBe(
        "&lt;script&gt;alert(&quot;xss &amp; &#39;danger&#39;&quot;);&lt;/script&gt;",
      );
    });
  });

  describe("renderWelcomeEmail", () => {
    it("renders welcome email with HTML and text alternatives", () => {
      const result = renderWelcomeEmail({
        recipientName: "Ada Lovelace",
        loginUrl: "https://lagan.dev/sign-in",
        appName: "Lagan Academy",
        appUrl: "https://lagan.dev",
        supportEmail: "help@lagan.dev",
        unsubscribeUrl: "https://lagan.dev/unsubscribe?token=123",
      });

      expect(result.subject).toBe("Welcome to Lagan Academy! Get started with your account");

      // HTML assertions
      expect(result.html).toContain("Ada Lovelace");
      expect(result.html).toContain("Welcome to Lagan Academy");
      expect(result.html).toContain("https://lagan.dev/sign-in");
      expect(result.html).toContain("help@lagan.dev");
      expect(result.html).toContain("https://lagan.dev/unsubscribe?token=123");
      expect(result.html).toContain("<!DOCTYPE html>");

      // Text assertions
      expect(result.text).toContain("Ada Lovelace");
      expect(result.text).toContain("https://lagan.dev/sign-in");
      expect(result.text).toContain("help@lagan.dev");
      expect(result.text).toContain("https://lagan.dev/unsubscribe?token=123");
    });

    it("escapes malicious user input in welcome email", () => {
      const result = renderWelcomeEmail({
        recipientName: `<img src=x onerror=alert('xss')>`,
        loginUrl: "https://lagan.dev/sign-in",
      });

      expect(result.html).not.toContain("<img src=x");
      expect(result.html).toContain("&lt;img src=x onerror=alert(&#39;xss&#39;)&gt;");
    });
  });

  describe("renderCourseEnrollmentEmail", () => {
    it("renders course enrollment confirmation", () => {
      const result = renderCourseEnrollmentEmail({
        recipientName: "Grace Hopper",
        courseTitle: "Distributed Systems 101",
        courseUrl: "https://lagan.dev/courses/ds-101",
        instructorName: "Dr. Leslie Lamport",
        startDate: "October 20, 2026",
        description: "Foundations of consensus and fault tolerance.",
      });

      expect(result.subject).toBe("You are enrolled in Distributed Systems 101");
      expect(result.html).toContain("Grace Hopper");
      expect(result.html).toContain("Distributed Systems 101");
      expect(result.html).toContain("Dr. Leslie Lamport");
      expect(result.html).toContain("October 20, 2026");
      expect(result.html).toContain("Foundations of consensus");
      expect(result.html).toContain("https://lagan.dev/courses/ds-101");

      expect(result.text).toContain("Distributed Systems 101");
      expect(result.text).toContain("Dr. Leslie Lamport");
      expect(result.text).toContain("https://lagan.dev/courses/ds-101");
    });
  });

  describe("renderNewContentPublishedEmail", () => {
    it("renders notification for newly published module or lesson", () => {
      const result = renderNewContentPublishedEmail({
        recipientName: "Alan Turing",
        courseTitle: "Computation Theory",
        contentTitle: "Turing Machines & Decidability",
        contentType: "lesson",
        contentUrl: "https://lagan.dev/courses/comp-theory/lessons/turing-machines",
        publishedBy: "Prof. Kurt Gödel",
        summary: "A deep dive into halting problems and diagonalisation.",
      });

      expect(result.subject).toBe(
        "New lesson in Computation Theory: Turing Machines & Decidability",
      );
      expect(result.html).toContain("Alan Turing");
      expect(result.html).toContain("Computation Theory");
      expect(result.html).toContain("Turing Machines &amp; Decidability");
      expect(result.html).toContain("Prof. Kurt Gödel");
      expect(result.html).toContain("A deep dive into halting problems and diagonalisation.");

      expect(result.text).toContain("Computation Theory");
      expect(result.text).toContain("Turing Machines & Decidability");
    });
  });

  describe("renderLessonCompleteEmail", () => {
    it("renders completion details with progress and next lesson", () => {
      const result = renderLessonCompleteEmail({
        recipientName: "Margaret Hamilton",
        courseTitle: "Apollo Guidance Systems",
        lessonTitle: "Priority Scheduling Under High Load",
        courseProgressPercent: 75,
        completedAt: "2026-10-19",
        nextLessonTitle: "Restart Proof Memory Architecture",
        nextLessonUrl: "https://lagan.dev/courses/apollo/lessons/restart-proof",
      });

      expect(result.subject).toBe(
        "Lesson complete: Priority Scheduling Under High Load (Apollo Guidance Systems)",
      );
      expect(result.html).toContain("Margaret Hamilton");
      expect(result.html).toContain("Priority Scheduling Under High Load");
      expect(result.html).toContain("75%");
      expect(result.html).toContain("Restart Proof Memory Architecture");
      expect(result.html).toContain("https://lagan.dev/courses/apollo/lessons/restart-proof");

      expect(result.text).toContain("Priority Scheduling Under High Load");
      expect(result.text).toContain("75%");
      expect(result.text).toContain("Restart Proof Memory Architecture");
    });
  });

  describe("renderNotificationTemplate router", () => {
    it("routes correctly to welcome template", () => {
      const result = renderNotificationTemplate("welcome", {
        recipientName: "Linus",
        loginUrl: "https://lagan.dev/login",
      });
      expect(result.subject).toContain("Welcome");
    });

    it("routes correctly to course enrollment template", () => {
      const result = renderNotificationTemplate("course_enrollment", {
        recipientName: "Linus",
        courseTitle: "Operating Systems",
        courseUrl: "https://lagan.dev/os",
      });
      expect(result.subject).toContain("You are enrolled");
    });

    it("routes correctly to new content template", () => {
      const result = renderNotificationTemplate("new_content_published", {
        recipientName: "Linus",
        courseTitle: "Kernel Architecture",
        contentTitle: "Virtual File System",
        contentType: "module",
        contentUrl: "https://lagan.dev/vfs",
      });
      expect(result.subject).toContain("New module");
    });

    it("routes correctly to lesson complete template", () => {
      const result = renderNotificationTemplate("lesson_complete", {
        recipientName: "Linus",
        courseTitle: "Kernel Architecture",
        lessonTitle: "Page Fault Handling",
      });
      expect(result.subject).toContain("Lesson complete");
    });
  });
});
