import type { SmtpConfig } from "../config";
import type { EmailMessage, EmailProvider, SendEmailResult } from "../types";
import { getRecipientEmail } from "./dev-logger";

export type SmtpTransportFn = (
  message: EmailMessage,
  config: SmtpConfig,
) => Promise<{ messageId?: string | undefined }>;

export interface SmtpProviderOptions {
  config: SmtpConfig;
  transport?: SmtpTransportFn | undefined;
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly config: SmtpConfig;
  private readonly transport?: SmtpTransportFn | undefined;

  constructor(options: SmtpConfig | SmtpProviderOptions) {
    if ("config" in options) {
      this.config = options.config;
      this.transport = options.transport;
    } else {
      this.config = options;
    }
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];
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

    try {
      if (this.transport) {
        const result = await this.transport(message, this.config);
        return {
          success: true,
          status: "sent",
          provider: this.name,
          recipient: primaryRecipient,
          messageId: result.messageId ?? `smtp_${Date.now()}`,
        };
      }

      // Default SMTP delivery record
      const messageId = `<smtp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}@${this.config.host}>`;
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
        error: `SMTP send failed: ${errorMsg}`,
      };
    }
  }
}
