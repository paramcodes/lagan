import type { CourseEnrollmentTemplateProps, EmailTemplateResult } from "../types";
import { escapeHtml, layoutHtml, layoutText } from "./layout";

export function renderCourseEnrollmentEmail(
  props: CourseEnrollmentTemplateProps,
): EmailTemplateResult {
  const subject = `You are enrolled in ${props.courseTitle}`;
  const name = props.recipientName.trim();

  const instructorRow = props.instructorName
    ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #4b5563;">
        Instructor: <strong style="color: #111827;">${escapeHtml(props.instructorName)}</strong>
      </p>`
    : "";

  const startDateRow = props.startDate
    ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #4b5563;">
        Starts: <strong style="color: #111827;">${escapeHtml(props.startDate)}</strong>
      </p>`
    : "";

  const descriptionSection = props.description
    ? `<p style="margin: 12px 0 0 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
        ${escapeHtml(props.description)}
      </p>`
    : "";

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
      Enrollment Confirmed
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(name)}, you have successfully been enrolled in <strong>${escapeHtml(
        props.courseTitle,
      )}</strong>.
    </p>

    <div style="margin: 20px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${escapeHtml(props.courseTitle)}
      </h2>
      ${instructorRow}
      ${startDateRow}
      ${descriptionSection}
    </div>

    <div style="margin: 28px 0 16px 0;">
      <a href="${escapeHtml(
        props.courseUrl,
      )}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        Go to Course &rarr;
      </a>
    </div>
    <p style="margin: 0; font-size: 13px; color: #6b7280;">
      You can access the course materials anytime from your dashboard.
    </p>
  `;

  const detailsList: string[] = [`Course: ${props.courseTitle}`];
  if (props.instructorName) detailsList.push(`Instructor: ${props.instructorName}`);
  if (props.startDate) detailsList.push(`Starts: ${props.startDate}`);
  if (props.description) detailsList.push(`\n${props.description}`);

  const contentText = `
Hi ${name},

You have successfully been enrolled in ${props.courseTitle}.

--- Course Details ---
${detailsList.join("\n")}

Go to Course:
${props.courseUrl}

You can access the course materials anytime from your dashboard.
`;

  return {
    subject,
    html: layoutHtml({
      title: subject,
      previewText: `You are enrolled in ${props.courseTitle}. Start learning now!`,
      categoryBadge: "Course Enrollment",
      contentHtml,
      appName: props.appName,
      appUrl: props.appUrl,
      supportEmail: props.supportEmail,
      unsubscribeUrl: props.unsubscribeUrl,
    }),
    text: layoutText({
      title: subject,
      contentText,
      appName: props.appName,
      appUrl: props.appUrl,
      supportEmail: props.supportEmail,
      unsubscribeUrl: props.unsubscribeUrl,
    }),
  };
}
