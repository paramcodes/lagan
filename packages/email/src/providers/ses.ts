import type { SesConfig } from "../config";
import type { EmailMessage, EmailProvider, SendEmailResult } from "../types";
import { formatRecipient, getRecipientEmail } from "./dev-logger";

export class SesEmailProvider implements EmailProvider {
  readonly name = "ses";
  private readonly region: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(config?: SesConfig | undefined) {
    this.region = config?.region || "us-east-1";
    this.endpoint =
      config?.endpoint?.replace(/\/+$/, "") || `https://email.${this.region}.amazonaws.com`;
    this.fetchFn = config?.fetch ?? globalThis.fetch;
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const toAddresses = toList.map(getRecipientEmail);
    const primaryRecipient = toAddresses[0] ?? "";

    if (!message.from) {
      return {
        success: false,
        status: "failed",
        provider: this.name,
        recipient: primaryRecipient,
        error: "Missing 'from' sender address",
      };
    }

    const payload = {
      FromEmailAddress: formatRecipient(message.from),
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: message.cc
          ? (Array.isArray(message.cc) ? message.cc : [message.cc]).map(getRecipientEmail)
          : undefined,
        BccAddresses: message.bcc
          ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]).map(getRecipientEmail)
          : undefined,
      },
      Content: {
        Simple: {
          Subject: {
            Data: message.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: message.html,
              Charset: "UTF-8",
            },
            Text: {
              Data: message.text,
              Charset: "UTF-8",
            },
          },
        },
      },
      ReplyToAddresses: message.replyTo ? [formatRecipient(message.replyTo)] : undefined,
    };

    try {
      const response = await this.fetchFn(`${this.endpoint}/v2/email/outbound-emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const errorMsg =
          typeof data.message === "string"
            ? data.message
            : `SES API returned HTTP ${response.status}`;
        return {
          success: false,
          status: "failed",
          provider: this.name,
          recipient: primaryRecipient,
          error: errorMsg,
        };
      }

      const messageId = typeof data.MessageId === "string" ? data.MessageId : undefined;

      return {
        success: true,
        status: "sent",
        provider: this.name,
        recipient: primaryRecipient,
        messageId,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: "failed",
        provider: this.name,
        recipient: primaryRecipient,
        error: `Network error sending via SES: ${errorMsg}`,
      };
    }
  }
}
