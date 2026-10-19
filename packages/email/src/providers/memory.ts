import type { EmailMessage, EmailProvider, SendEmailResult } from "../types";
import { getRecipientEmail } from "./dev-logger";

export class MemoryEmailProvider implements EmailProvider {
  readonly name = "memory";
  private readonly sentEmails: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<SendEmailResult> {
    this.sentEmails.push({ ...message });

    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const primaryRecipient = getRecipientEmail(toList[0] ?? "");
    const messageId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      success: true,
      status: "sent",
      provider: this.name,
      recipient: primaryRecipient,
      messageId,
    };
  }

  getSentEmails(): readonly EmailMessage[] {
    return [...this.sentEmails];
  }

  getLastEmail(): EmailMessage | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  findEmail(predicate: (email: EmailMessage) => boolean): EmailMessage | undefined {
    return this.sentEmails.find(predicate);
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
