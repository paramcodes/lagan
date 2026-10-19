export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LayoutHtmlOptions {
  title: string;
  previewText?: string | undefined;
  contentHtml: string;
  categoryBadge?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
}

export interface LayoutTextOptions {
  title: string;
  contentText: string;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
}

export function layoutHtml(options: LayoutHtmlOptions): string {
  const appName = options.appName ?? "Lagan";
  const appUrl = options.appUrl ?? "https://lagan.dev";
  const preview = options.previewText
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(
        options.previewText,
      )}</div>`
    : "";

  const badgeHtml = options.categoryBadge
    ? `<tr>
        <td style="padding: 0 0 12px 0;">
          <span style="display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #2563eb; background-color: #eff6ff; border-radius: 9999px;">
            ${escapeHtml(options.categoryBadge)}
          </span>
        </td>
      </tr>`
    : "";

  const footerUnsubscribe = options.unsubscribeUrl
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
        If you no longer wish to receive these notifications, you can <a href="${escapeHtml(
          options.unsubscribeUrl,
        )}" style="color: #2563eb; text-decoration: underline;">unsubscribe here</a>.
      </p>`
    : "";

  const footerSupport = options.supportEmail
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
        Questions or need help? Contact <a href="mailto:${escapeHtml(
          options.supportEmail,
        )}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(
          options.supportEmail,
        )}</a>.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  ${preview}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #f3f4f6;">
              <a href="${escapeHtml(
                appUrl,
              )}" style="font-size: 20px; font-weight: 700; color: #111827; text-decoration: none; letter-spacing: -0.02em;">
                ${escapeHtml(appName)}
              </a>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${badgeHtml}
                <tr>
                  <td>
                    ${options.contentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; font-size: 12px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">
                Sent by <strong>${escapeHtml(
                  appName,
                )}</strong>. You are receiving this because of your account activity on <a href="${escapeHtml(
                  appUrl,
                )}" style="color: #6b7280; text-decoration: underline;">${escapeHtml(appUrl)}</a>.
              </p>
              ${footerSupport}
              ${footerUnsubscribe}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function layoutText(options: LayoutTextOptions): string {
  const appName = options.appName ?? "Lagan";
  const appUrl = options.appUrl ?? "https://lagan.dev";

  const lines: string[] = [
    `=== ${appName.toUpperCase()} ===`,
    "",
    options.contentText.trim(),
    "",
    "---",
    `Sent by ${appName} (${appUrl})`,
  ];

  if (options.supportEmail) {
    lines.push(`Support: ${options.supportEmail}`);
  }

  if (options.unsubscribeUrl) {
    lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  }

  return lines.join("\n");
}
