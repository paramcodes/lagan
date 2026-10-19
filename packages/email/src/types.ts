export type EmailAddress = string;

export interface EmailRecipient {
  email: string;
  name?: string | undefined;
}

export type EmailRecipientInput = EmailAddress | EmailRecipient;

export interface EmailAttachment {
  filename: string;
  content: string | Uint8Array;
  contentType?: string | undefined;
}

export interface EmailMessage {
  to: EmailRecipientInput | EmailRecipientInput[];
  from?: EmailRecipientInput | undefined;
  replyTo?: EmailRecipientInput | undefined;
  cc?: EmailRecipientInput | EmailRecipientInput[] | undefined;
  bcc?: EmailRecipientInput | EmailRecipientInput[] | undefined;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string> | undefined;
  tags?: Record<string, string> | undefined;
  attachments?: EmailAttachment[] | undefined;
}

export type EmailSendStatus = "sent" | "suppressed" | "failed";

export interface SendEmailResult {
  success: boolean;
  status: EmailSendStatus;
  provider: string;
  recipient: string;
  messageId?: string | undefined;
  error?: string | undefined;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendEmailResult>;
}

export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "manual";

export interface SuppressionRecord {
  email: string;
  reason: SuppressionReason;
  suppressedAt: Date;
  metadata?: Record<string, unknown> | undefined;
}

export interface SuppressionStore {
  isSuppressed(email: string): Promise<boolean> | boolean;
  suppress(
    email: string,
    reason?: SuppressionReason | undefined,
    metadata?: Record<string, unknown> | undefined,
  ): Promise<void> | void;
  unsuppress(email: string): Promise<void> | void;
  getRecord?(email: string): Promise<SuppressionRecord | null> | SuppressionRecord | null;
  listAll?(): Promise<SuppressionRecord[]> | SuppressionRecord[];
}

export type NotificationType =
  | "welcome"
  | "course_enrollment"
  | "new_content_published"
  | "lesson_complete";

export interface BaseTemplateProps {
  recipientName: string;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
}

export interface WelcomeTemplateProps extends BaseTemplateProps {
  loginUrl: string;
}

export interface CourseEnrollmentTemplateProps extends BaseTemplateProps {
  courseTitle: string;
  courseUrl: string;
  instructorName?: string | undefined;
  description?: string | undefined;
  startDate?: string | undefined;
}

export type PublishedContentType = "module" | "lesson" | "assignment" | "announcement";

export interface NewContentPublishedTemplateProps extends BaseTemplateProps {
  courseTitle: string;
  contentTitle: string;
  contentType: PublishedContentType;
  contentUrl: string;
  publishedBy?: string | undefined;
  summary?: string | undefined;
}

export interface LessonCompleteTemplateProps extends BaseTemplateProps {
  courseTitle: string;
  lessonTitle: string;
  courseProgressPercent?: number | undefined;
  nextLessonTitle?: string | undefined;
  nextLessonUrl?: string | undefined;
  completedAt?: string | undefined;
}

export interface NotificationPayloadMap {
  welcome: WelcomeTemplateProps;
  course_enrollment: CourseEnrollmentTemplateProps;
  new_content_published: NewContentPublishedTemplateProps;
  lesson_complete: LessonCompleteTemplateProps;
}

export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}
