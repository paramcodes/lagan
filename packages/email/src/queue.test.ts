import { describe, expect, it, vi } from "vitest";
import { MemoryEmailProvider } from "./providers/memory";
import { createEmailJobHandler, InMemoryEmailJobQueue } from "./queue";
import { createEmailService } from "./service";
import { InMemorySuppressionStore } from "./suppression";
import type { EmailProvider } from "./types";

describe("Email Queue Integration", () => {
  it("processes notification jobs and delivers email", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: memoryProvider,
    });

    const handler = createEmailJobHandler(service);

    const result = await handler({
      kind: "notification",
      to: "student@example.com",
      type: "welcome",
      props: {
        recipientName: "Student One",
        loginUrl: "https://lagan.dev/sign-in",
      },
    });

    expect(result.status).toBe("sent");
    expect(result.messageId).toMatch(/^mem_/);
    expect(memoryProvider.getSentEmails()).toHaveLength(1);
    expect(memoryProvider.getLastEmail()?.to).toBe("student@example.com");
  });

  it("skips suppressed recipient without rethrowing error", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const suppressionStore = new InMemorySuppressionStore(["blocked@example.com"]);
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: memoryProvider,
      suppressionStore,
    });

    const handler = createEmailJobHandler(service);

    const result = await handler({
      kind: "notification",
      to: "blocked@example.com",
      type: "welcome",
      props: {
        recipientName: "Blocked User",
        loginUrl: "https://lagan.dev/sign-in",
      },
    });

    expect(result.status).toBe("suppressed");
    expect(result.suppressed).toBe(true);
    expect(memoryProvider.getSentEmails()).toHaveLength(0);
  });

  it("throws on delivery failure to allow queue backoff retry", async () => {
    const failingProvider: EmailProvider = {
      name: "failing-provider",
      send: vi.fn().mockResolvedValue({
        success: false,
        status: "failed",
        provider: "failing-provider",
        recipient: "err@example.com",
        error: "SMTP connection timeout",
      }),
    };

    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: failingProvider,
    });

    const handler = createEmailJobHandler(service);

    await expect(
      handler({
        kind: "raw",
        message: {
          to: "err@example.com",
          subject: "Failing",
          html: "<p>Failing</p>",
          text: "Failing",
        },
      }),
    ).rejects.toThrow("SMTP connection timeout");
  });

  it("operates in-memory queue lifecycle with attempts and status tracking", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: memoryProvider,
    });

    const queue = new InMemoryEmailJobQueue(service);

    const jobId = await queue.enqueue({
      kind: "notification",
      to: "learner@example.com",
      type: "course_enrollment",
      props: {
        recipientName: "Learner",
        courseTitle: "Cloud Architecture",
        courseUrl: "https://lagan.dev/courses/cloud",
      },
    });

    expect(jobId).toMatch(/^job_/);
    expect(queue.getJobs()).toHaveLength(1);
    expect(queue.getJobs()[0]?.status).toBe("pending");

    const result = await queue.processNext();
    expect(result?.status).toBe("sent");
    expect(queue.getJobs()[0]?.status).toBe("completed");
    expect(queue.getJobs()[0]?.attempts).toBe(1);
  });
});
