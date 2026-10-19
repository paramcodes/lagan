// Types
export type {
  BaseTemplateProps,
  CourseEnrollmentTemplateProps,
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  EmailProvider,
  EmailRecipient,
  EmailRecipientInput,
  EmailSendStatus,
  EmailTemplateResult,
  LessonCompleteTemplateProps,
  NewContentPublishedTemplateProps,
  NotificationPayloadMap,
  NotificationType,
  PublishedContentType,
  SendEmailResult,
  SuppressionReason,
  SuppressionRecord,
  SuppressionStore,
  WelcomeTemplateProps,
} from "./types";

// Service
export {
  createEmailService,
  DefaultEmailService,
} from "./service";
export type { EmailService, EmailServiceOptions } from "./service";

// Config
export { loadEmailConfigFromEnv } from "./config";
export type {
  EmailConfig,
  EmailProviderType,
  ResendConfig,
  SesConfig,
  SmtpConfig,
} from "./config";

// Providers
export {
  createEmailProvider,
  DevLoggerProvider,
  formatRecipient,
  getRecipientEmail,
  MemoryEmailProvider,
  ResendEmailProvider,
  SesEmailProvider,
  SmtpEmailProvider,
} from "./providers";
export type {
  DevLoggerOptions,
  SmtpProviderOptions,
  SmtpTransportFn,
} from "./providers";

// Suppression
export {
  createSuppressionStore,
  InMemorySuppressionStore,
  normalizeEmail,
} from "./suppression";

// Templates
export {
  escapeHtml,
  layoutHtml,
  layoutText,
  renderCourseEnrollmentEmail,
  renderLessonCompleteEmail,
  renderNewContentPublishedEmail,
  renderNotificationTemplate,
  renderWelcomeEmail,
} from "./templates";
export type {
  LayoutHtmlOptions,
  LayoutTextOptions,
} from "./templates";

// Queue integration
export {
  createEmailJobHandler,
  InMemoryEmailJobQueue,
} from "./queue";
export type {
  EmailJobData,
  EmailJobRecord,
  EmailJobResult,
} from "./queue";
