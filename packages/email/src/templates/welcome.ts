import type { EmailTemplateResult, WelcomeTemplateProps } from "../types";
import { escapeHtml, layoutHtml, layoutText } from "./layout";

export function renderWelcomeEmail(props: WelcomeTemplateProps): EmailTemplateResult {
  const appName = props.appName ?? "Lagan";
  const subject = `Welcome to ${appName}! Get started with your account`;
  const name = props.recipientName.trim();

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
      Welcome to ${escapeHtml(appName)}, ${escapeHtml(name)}!
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
      We&#39;re thrilled to have you here. Your account is active and ready to use. Explore available courses, track your learning progress, and interact with fellow learners.
    </p>
    <div style="margin: 24px 0;">
      <a href="${escapeHtml(
        props.loginUrl,
      )}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        Sign in to your account &rarr;
      </a>
    </div>
    <div style="margin: 24px 0 0 0; padding: 16px; background-color: #f9fafb; border-radius: 6px; border-left: 3px solid #2563eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827;">Quick tip to get started:</p>
      <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
        Complete your learner profile and browse the course catalog to enroll in your first course.
      </p>
    </div>
  `;

  const contentText = `
Welcome to ${appName}, ${name}!

We're thrilled to have you here. Your account is active and ready to use. Explore available courses, track your learning progress, and interact with fellow learners.

Sign in to your account:
${props.loginUrl}

Quick tip to get started:
Complete your learner profile and browse the course catalog to enroll in your first course.
`;

  return {
    subject,
    html: layoutHtml({
      title: subject,
      previewText: `Welcome to ${appName}! Sign in to get started with your courses.`,
      categoryBadge: "Welcome",
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
