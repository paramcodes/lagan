import type { ResendConfig } from "../config";
import type { EmailMessage, EmailProvider, SendEmailResult } from "../types";
import { formatRecipient, getRecipientEmail } from "./dev-logger";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: ResendConfig) {
    if (!config.apiKey) {
      throw new Error("Resend provider requires an apiKey");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/+$/, "") || "https://api.resend.com";
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const toAddresses = toList.map(formatRecipient);
    const primaryRecipient = getRecipientEmail(toList[0] ?? "");

    if (!message.from) {
      return {
        success: false,
        status: "failed",
        provider: this.name,
        recipient: primaryRecipient,
        error: "Missing 'from' sender address",
      };
    }

    const body: Record<string, unknown> = {
      from: formatRecipient(message.from),
      to: toAddresses,
      subject: message.subject,
      html: message.html,
      text: message.text,
    };

    if (message.replyTo) {
      body.reply_to = formatRecipient(message.replyTo);
    }

    if (message.cc) {
      const ccList = Array.isArray(message.cc) ? message.cc : [message.cc];
      body.cc = ccList.map(formatRecipient);
    }

    if (message.bcc) {
      const bccList = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
      body.bcc = bccList.map(formatRecipient);
    }

    if (message.headers) {
      body.headers = message.headers;
    }

    if (message.tags) {
      body.tags = Object.entries(message.tags).map(([name, value]) => ({
        name,
        value,
      }));
    }

    try {
      const response = await this.fetchFn(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const errorMsg =
          typeof data.message === "string"
            ? data.message
            : `Resend API returned HTTP ${response.status}`;
        return {
          success: false,
          status: "failed",
          provider: this.name,
          recipient: primaryRecipient,
          error: errorMsg,
        };
      }

      const messageId = typeof data.id === "string" ? data.id : undefined;

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
        error: `Network error sending via Resend: ${errorMsg}`,
      };
    }
  }
}
