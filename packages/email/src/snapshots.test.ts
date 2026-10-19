import { describe, expect, it } from "vitest";
import {
  renderCourseEnrollmentEmail,
  renderLessonCompleteEmail,
  renderNewContentPublishedEmail,
  renderWelcomeEmail,
} from "./templates";

describe("Email Template Snapshots", () => {
  it("matches snapshot for welcome email", () => {
    const result = renderWelcomeEmail({
      recipientName: "Marie Curie",
      loginUrl: "https://lagan.dev/sign-in",
      appName: "Lagan",
      appUrl: "https://lagan.dev",
      supportEmail: "support@lagan.dev",
      unsubscribeUrl: "https://lagan.dev/unsubscribe?token=sample",
    });

    expect(result.subject).toMatchSnapshot("welcome-subject");
    expect(result.html).toMatchSnapshot("welcome-html");
    expect(result.text).toMatchSnapshot("welcome-text");
  });

  it("matches snapshot for course enrollment email", () => {
    const result = renderCourseEnrollmentEmail({
      recipientName: "Marie Curie",
      courseTitle: "Introduction to Radioactivity",
      courseUrl: "https://lagan.dev/courses/rad-101",
      instructorName: "Henri Becquerel",
      description: "Comprehensive study of spontaneous radiation and atomic decay.",
      startDate: "November 1, 2026",
      appName: "Lagan",
      appUrl: "https://lagan.dev",
      supportEmail: "support@lagan.dev",
      unsubscribeUrl: "https://lagan.dev/unsubscribe?token=sample",
    });

    expect(result.subject).toMatchSnapshot("course-enrollment-subject");
    expect(result.html).toMatchSnapshot("course-enrollment-html");
    expect(result.text).toMatchSnapshot("course-enrollment-text");
  });

  it("matches snapshot for new content published email", () => {
    const result = renderNewContentPublishedEmail({
      recipientName: "Marie Curie",
      courseTitle: "Introduction to Radioactivity",
      contentTitle: "Isolation of Polonium and Radium",
      contentType: "lesson",
      contentUrl: "https://lagan.dev/courses/rad-101/lessons/polonium",
      publishedBy: "Pierre Curie",
      summary: "Detailed chemical separation notes and pitchblende analysis.",
      appName: "Lagan",
      appUrl: "https://lagan.dev",
      supportEmail: "support@lagan.dev",
      unsubscribeUrl: "https://lagan.dev/unsubscribe?token=sample",
    });

    expect(result.subject).toMatchSnapshot("new-content-subject");
    expect(result.text).toMatchSnapshot("new-content-text");
  });

  it("matches snapshot for lesson complete email", () => {
    const result = renderLessonCompleteEmail({
      recipientName: "Marie Curie",
      courseTitle: "Introduction to Radioactivity",
      lessonTitle: "Isolation of Polonium and Radium",
      courseProgressPercent: 80,
      nextLessonTitle: "Therapeutic Uses of Radium",
      nextLessonUrl: "https://lagan.dev/courses/rad-101/lessons/therapeutic-uses",
      completedAt: "2026-10-19",
      appName: "Lagan",
      appUrl: "https://lagan.dev",
      supportEmail: "support@lagan.dev",
      unsubscribeUrl: "https://lagan.dev/unsubscribe?token=sample",
    });

    expect(result.subject).toMatchSnapshot("lesson-complete-subject");
    expect(result.text).toMatchSnapshot("lesson-complete-text");
  });
});
