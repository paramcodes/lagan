import type { EmailConfig } from "./config";
import { createEmailProvider } from "./providers";
import { getRecipientEmail } from "./providers/dev-logger";
import { InMemorySuppressionStore } from "./suppression";
import { renderNotificationTemplate } from "./templates";
import type {
  EmailMessage,
  EmailProvider,
  EmailRecipientInput,
  NotificationPayloadMap,
  NotificationType,
  SendEmailResult,
  SuppressionReason,
  SuppressionStore,
} from "./types";

export interface EmailServiceOptions {
  config: EmailConfig;
  provider?: EmailProvider | undefined;
  suppressionStore?: SuppressionStore | undefined;
}

export interface EmailService {
  readonly provider: EmailProvider;
  readonly suppressionStore: SuppressionStore;
  readonly config: EmailConfig;

  send(message: EmailMessage): Promise<SendEmailResult>;
  sendBatch(messages: EmailMessage[]): Promise<SendEmailResult[]>;
  sendNotification<T extends NotificationType>(
    to: EmailRecipientInput,
    type: T,
    props: NotificationPayloadMap[T],
    options?: Partial<Omit<EmailMessage, "to" | "subject" | "html" | "text">> | undefined,
  ): Promise<SendEmailResult>;
  isSuppressed(email: string): Promise<boolean>;
  suppress(
    email: string,
    reason?: SuppressionReason | undefined,
    metadata?: Record<string, unknown> | undefined,
  ): Promise<void>;
  unsuppress(email: string): Promise<void>;
}

export class DefaultEmailService implements EmailService {
  readonly provider: EmailProvider;
  readonly suppressionStore: SuppressionStore;
  readonly config: EmailConfig;

  constructor(options: EmailServiceOptions) {
    this.config = options.config;
    this.provider = options.provider ?? createEmailProvider(options.config);
    this.suppressionStore =
      options.suppressionStore ?? options.config.suppressionStore ?? new InMemorySuppressionStore();
  }

  async isSuppressed(email: string): Promise<boolean> {
    return Promise.resolve(this.suppressionStore.isSuppressed(email));
  }

  async suppress(
    email: string,
    reason?: SuppressionReason | undefined,
    metadata?: Record<string, unknown> | undefined,
  ): Promise<void> {
    await this.suppressionStore.suppress(email, reason, metadata);
  }

  async unsuppress(email: string): Promise<void> {
    await this.suppressionStore.unsuppress(email);
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];

    // Check suppression for all recipients
    for (const recipient of toList) {
      const email = getRecipientEmail(recipient);
      const isSuppressed = await this.suppressionStore.isSuppressed(email);
      if (isSuppressed) {
        return {
          success: false,
          status: "suppressed",
          provider: this.provider.name,
          recipient: email,
          error: `Recipient ${email} is on the suppression list`,
        };
      }
    }

    const resolvedMessage: EmailMessage = {
      ...message,
      from: message.from ?? this.config.defaultFrom,
      replyTo: message.replyTo ?? this.config.replyTo,
    };

    return this.provider.send(resolvedMessage);
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendEmailResult[]> {
    return Promise.all(messages.map((msg) => this.send(msg)));
  }

  async sendNotification<T extends NotificationType>(
    to: EmailRecipientInput,
    type: T,
    props: NotificationPayloadMap[T],
    options?: Partial<Omit<EmailMessage, "to" | "subject" | "html" | "text">> | undefined,
  ): Promise<SendEmailResult> {
    // Inject appName/appUrl if not present in template props
    const enrichedProps = {
      appName: this.config.appName,
      appUrl: this.config.appUrl,
      ...props,
    };

    const rendered = renderNotificationTemplate(type, enrichedProps as NotificationPayloadMap[T]);

    const message: EmailMessage = {
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...options,
    };

    return this.send(message);
  }
}

export function createEmailService(
  configOrOptions: EmailConfig | EmailServiceOptions,
): EmailService {
  if ("config" in configOrOptions) {
    return new DefaultEmailService(configOrOptions);
  }
  return new DefaultEmailService({ config: configOrOptions });
}
