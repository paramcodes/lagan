import type { EmailMessage, EmailProvider, EmailRecipientInput, SendEmailResult } from "../types";

export interface DevLoggerOptions {
  logFn?: ((message: string) => void) | undefined;
}

export function formatRecipient(recipient: EmailRecipientInput): string {
  if (typeof recipient === "string") {
    return recipient;
  }
  return recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;
}

export function getRecipientEmail(recipient: EmailRecipientInput): string {
  return typeof recipient === "string" ? recipient : recipient.email;
}

export class DevLoggerProvider implements EmailProvider {
  readonly name = "dev-logger";
  private readonly logFn: (message: string) => void;

  constructor(options?: DevLoggerOptions | undefined) {
    this.logFn = options?.logFn ?? console.log;
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const toFormatted = toList.map(formatRecipient).join(", ");
    const primaryRecipient = getRecipientEmail(toList[0] ?? "");
    const fromFormatted = message.from ? formatRecipient(message.from) : "default-sender";

    const banner = [
      "",
      "┌────────────────────────────────────────────────────────────────────────┐",
      "│                       [LAGAN EMAIL DEV LOGGER]                        │",
      "├────────────────────────────────────────────────────────────────────────┤",
      `│ To:      ${toFormatted.padEnd(61).slice(0, 61)} │`,
      `│ From:    ${fromFormatted.padEnd(61).slice(0, 61)} │`,
      `│ Subject: ${message.subject.padEnd(61).slice(0, 61)} │`,
      "├────────────────────────────────────────────────────────────────────────┤",
      "│ PLAIN TEXT BODY:                                                       │",
      ...message.text.split("\n").map((line) => `│ ${line.padEnd(70).slice(0, 70)} │`),
      "└────────────────────────────────────────────────────────────────────────┘",
      "",
    ].join("\n");

    this.logFn(banner);

    const messageId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      success: true,
      status: "sent",
      provider: this.name,
      recipient: primaryRecipient,
      messageId,
    };
  }
}
