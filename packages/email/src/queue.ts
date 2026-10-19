import type { EmailService } from "./service";
import type {
  EmailMessage,
  EmailRecipientInput,
  NotificationPayloadMap,
  NotificationType,
  SendEmailResult,
} from "./types";

export type EmailJobData =
  | {
      kind: "notification";
      to: EmailRecipientInput;
      type: NotificationType;
      props: Record<string, unknown>;
      options?: Partial<Omit<EmailMessage, "to" | "subject" | "html" | "text">> | undefined;
    }
  | {
      kind: "raw";
      message: EmailMessage;
    };

export interface EmailJobRecord {
  id: string;
  data: EmailJobData;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  status: "pending" | "processing" | "completed" | "failed" | "suppressed";
  lastError?: string | undefined;
}

export interface EmailJobResult {
  status: "sent" | "suppressed" | "failed";
  messageId?: string | undefined;
  suppressed?: boolean | undefined;
  error?: string | undefined;
}
export function createEmailJobHandler(emailService: EmailService) {
  return async (jobData: EmailJobData): Promise<EmailJobResult> => {
    let result: SendEmailResult;

    if (jobData.kind === "notification") {
      result = await emailService.sendNotification(
        jobData.to,
        jobData.type,
        jobData.props as unknown as NotificationPayloadMap[typeof jobData.type],
        jobData.options,
      );
    } else {
      result = await emailService.send(jobData.message);
    }

    if (result.status === "suppressed") {
      // Suppressed addresses should not retry — mark as skipped/suppressed cleanly
      return {
        status: "suppressed",
        suppressed: true,
      };
    }

    if (!result.success || result.status === "failed") {
      // Throw error to trigger queue retry with backoff
      throw new Error(result.error ?? `Email delivery failed via ${result.provider}`);
    }

    return {
      status: "sent",
      messageId: result.messageId,
    };
  };
}

export class InMemoryEmailJobQueue {
  private readonly jobs: EmailJobRecord[] = [];
  private readonly handler: (jobData: EmailJobData) => Promise<EmailJobResult>;

  constructor(emailService: EmailService) {
    this.handler = createEmailJobHandler(emailService);
  }

  async enqueue(
    data: EmailJobData,
    options?: { maxAttempts?: number | undefined } | undefined,
  ): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const job: EmailJobRecord = {
      id,
      data,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      createdAt: new Date(),
      status: "pending",
    };
    this.jobs.push(job);
    return id;
  }

  async processNext(): Promise<EmailJobResult | null> {
    const job = this.jobs.find((j) => j.status === "pending");
    if (!job) return null;

    job.status = "processing";
    job.attempts += 1;

    try {
      const result = await this.handler(job.data);
      job.status = result.status === "suppressed" ? "suppressed" : "completed";
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errorMsg;
      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
      } else {
        job.status = "pending";
      }
      throw err;
    }
  }

  getJobs(): readonly EmailJobRecord[] {
    return [...this.jobs];
  }

  clear(): void {
    this.jobs.length = 0;
  }
}
