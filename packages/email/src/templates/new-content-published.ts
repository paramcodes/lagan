import type { EmailTemplateResult, NewContentPublishedTemplateProps } from "../types";
import { escapeHtml, layoutHtml, layoutText } from "./layout";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  module: "Module",
  lesson: "Lesson",
  assignment: "Assignment",
  announcement: "Announcement",
};

export function renderNewContentPublishedEmail(
  props: NewContentPublishedTemplateProps,
): EmailTemplateResult {
  const typeFormatted =
    CONTENT_TYPE_LABELS[props.contentType] ??
    props.contentType.charAt(0).toUpperCase() + props.contentType.slice(1);
  const subject = `New ${typeFormatted.toLowerCase()} in ${props.courseTitle}: ${props.contentTitle}`;
  const name = props.recipientName.trim();

  const publishedByRow = props.publishedBy
    ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">
        Posted by: <strong>${escapeHtml(props.publishedBy)}</strong>
      </p>`
    : "";

  const summarySection = props.summary
    ? `<div style="margin: 16px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 14px; line-height: 1.6; color: #374151;">
        ${escapeHtml(props.summary)}
      </div>`
    : "";

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
      New Content Published
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(name)}, a new ${escapeHtml(
        typeFormatted.toLowerCase(),
      )} has just been published in <strong>${escapeHtml(props.courseTitle)}</strong>.
    </p>

    <div style="margin: 20px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #4338ca; background-color: #e0e7ff; border-radius: 4px; margin-bottom: 8px;">
        ${escapeHtml(typeFormatted)}
      </span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${escapeHtml(props.contentTitle)}
      </h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">
        Course: ${escapeHtml(props.courseTitle)}
      </p>
      ${publishedByRow}
      ${summarySection}
    </div>

    <div style="margin: 28px 0 16px 0;">
      <a href="${escapeHtml(
        props.contentUrl,
      )}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        View ${escapeHtml(typeFormatted)} &rarr;
      </a>
    </div>
  `;

  const detailsList: string[] = [
    `Course: ${props.courseTitle}`,
    `Type: ${typeFormatted}`,
    `Title: ${props.contentTitle}`,
  ];
  if (props.publishedBy) detailsList.push(`Posted by: ${props.publishedBy}`);
  if (props.summary) detailsList.push(`\nSummary:\n${props.summary}`);

  const contentText = `
Hi ${name},

A new ${typeFormatted.toLowerCase()} has just been published in ${props.courseTitle}.

--- Details ---
${detailsList.join("\n")}

View content:
${props.contentUrl}
`;

  return {
    subject,
    html: layoutHtml({
      title: subject,
      previewText: `New ${typeFormatted.toLowerCase()} in ${props.courseTitle}: ${props.contentTitle}`,
      categoryBadge: "Course Update",
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
