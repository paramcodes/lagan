import type { EmailConfig } from "../config";
import type { EmailProvider } from "../types";
import { DevLoggerProvider } from "./dev-logger";
import { MemoryEmailProvider } from "./memory";
import { ResendEmailProvider } from "./resend";
import { SesEmailProvider } from "./ses";
import { SmtpEmailProvider } from "./smtp";

export { DevLoggerProvider, formatRecipient, getRecipientEmail } from "./dev-logger";
export type { DevLoggerOptions } from "./dev-logger";
export { MemoryEmailProvider } from "./memory";
export { ResendEmailProvider } from "./resend";
export { SesEmailProvider } from "./ses";
export { SmtpEmailProvider } from "./smtp";
export type { SmtpProviderOptions, SmtpTransportFn } from "./smtp";

export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case "logger":
    case "dev":
      return new DevLoggerProvider();
    case "memory":
    case "test":
      return new MemoryEmailProvider();
    case "resend":
      if (!config.resend) {
        throw new Error("Resend provider selected but no 'resend' configuration provided");
      }
      return new ResendEmailProvider(config.resend);
    case "ses":
      return new SesEmailProvider(config.ses);
    case "smtp":
      if (!config.smtp) {
        throw new Error("SMTP provider selected but no 'smtp' configuration provided");
      }
      return new SmtpEmailProvider(config.smtp);
    default:
      return new DevLoggerProvider();
  }
}
