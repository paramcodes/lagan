import type { EmailTemplateResult, LessonCompleteTemplateProps } from "../types";
import { escapeHtml, layoutHtml, layoutText } from "./layout";

export function renderLessonCompleteEmail(props: LessonCompleteTemplateProps): EmailTemplateResult {
  const subject = `Lesson complete: ${props.lessonTitle} (${props.courseTitle})`;
  const name = props.recipientName.trim();

  const progressSection =
    typeof props.courseProgressPercent === "number"
      ? `<div style="margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151;">
            <span>Course Progress</span>
            <span>${Math.round(props.courseProgressPercent)}%</span>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
            <tr>
              <td style="width: ${Math.min(
                100,
                Math.max(0, Math.round(props.courseProgressPercent)),
              )}%; background-color: #10b981; height: 8px;"></td>
              <td></td>
            </tr>
          </table>
        </div>`
      : "";

  const nextLessonSection =
    props.nextLessonTitle && props.nextLessonUrl
      ? `<div style="margin: 24px 0 0 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #166534;">
            Up Next
          </p>
          <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #14532d;">
            ${escapeHtml(props.nextLessonTitle)}
          </p>
          <a href="${escapeHtml(
            props.nextLessonUrl,
          )}" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
            Continue to Next Lesson &rarr;
          </a>
        </div>`
      : "";

  const completedAtRow = props.completedAt
    ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280;">Completed on ${escapeHtml(
        props.completedAt,
      )}</p>`
    : "";

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
      Great job, ${escapeHtml(name)}!
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
      You have successfully finished the lesson <strong>${escapeHtml(
        props.lessonTitle,
      )}</strong> in <strong>${escapeHtml(props.courseTitle)}</strong>.
    </p>

    <div style="margin: 20px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #047857; background-color: #d1fae5; border-radius: 4px; margin-bottom: 8px;">
        Completed
      </span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${escapeHtml(props.lessonTitle)}
      </h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">
        Course: ${escapeHtml(props.courseTitle)}
      </p>
      ${completedAtRow}
      ${progressSection}
    </div>

    ${nextLessonSection}
  `;

  const detailsList: string[] = [
    `Course: ${props.courseTitle}`,
    `Completed Lesson: ${props.lessonTitle}`,
  ];
  if (typeof props.courseProgressPercent === "number") {
    detailsList.push(`Course Progress: ${Math.round(props.courseProgressPercent)}%`);
  }
  if (props.completedAt) {
    detailsList.push(`Completed: ${props.completedAt}`);
  }
  if (props.nextLessonTitle && props.nextLessonUrl) {
    detailsList.push(`\nUp Next: ${props.nextLessonTitle}\nContinue: ${props.nextLessonUrl}`);
  }

  const contentText = `
Great job, ${name}!

You have finished the lesson "${props.lessonTitle}" in ${props.courseTitle}.

--- Details ---
${detailsList.join("\n")}
`;

  return {
    subject,
    html: layoutHtml({
      title: subject,
      previewText: `You finished ${props.lessonTitle} in ${props.courseTitle}. Keep up the great work!`,
      categoryBadge: "Achievement",
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
