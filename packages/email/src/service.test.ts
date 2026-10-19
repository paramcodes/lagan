import { describe, expect, it } from "vitest";
import { MemoryEmailProvider } from "./providers/memory";
import { createEmailService } from "./service";
import { InMemorySuppressionStore } from "./suppression";
import type { EmailMessage } from "./types";

describe("EmailService", () => {
  it("sends email and applies default sender config", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "Lagan Notifications <notifications@lagan.dev>",
        replyTo: "support@lagan.dev",
        appName: "Lagan LMS",
      },
      provider: memoryProvider,
    });

    const message: EmailMessage = {
      to: "learner@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    };

    const result = await service.send(message);

    expect(result.success).toBe(true);
    expect(result.status).toBe("sent");

    const sent = memoryProvider.getLastEmail();
    expect(sent).toBeDefined();
    expect(sent?.from).toBe("Lagan Notifications <notifications@lagan.dev>");
    expect(sent?.replyTo).toBe("support@lagan.dev");
    expect(sent?.to).toBe("learner@example.com");
  });

  it("skips suppressed email addresses without calling provider", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const suppressionStore = new InMemorySuppressionStore(["unsubscribed@example.com"]);

    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: memoryProvider,
      suppressionStore,
    });

    const result = await service.send({
      to: "unsubscribed@example.com",
      subject: "Important announcement",
      html: "<p>Read this</p>",
      text: "Read this",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("suppressed");
    expect(result.recipient).toBe("unsubscribed@example.com");
    expect(result.error).toContain("suppression list");

    // Provider should not have received any message
    expect(memoryProvider.getSentEmails()).toHaveLength(0);
  });

  it("renders notification templates and sends correctly", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
        appName: "Lagan Global",
        appUrl: "https://lagan.dev",
      },
      provider: memoryProvider,
    });

    const result = await service.sendNotification("student@uni.edu", "welcome", {
      recipientName: "Student",
      loginUrl: "https://lagan.dev/login",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("sent");

    const sent = memoryProvider.getLastEmail();
    expect(sent?.subject).toContain("Welcome to Lagan Global");
    expect(sent?.html).toContain("Student");
    expect(sent?.text).toContain("https://lagan.dev/login");
  });

  it("handles batch sending with mixed suppression states", async () => {
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

    const results = await service.sendBatch([
      {
        to: "active1@example.com",
        subject: "Message 1",
        html: "<p>1</p>",
        text: "1",
      },
      {
        to: "blocked@example.com",
        subject: "Message 2",
        html: "<p>2</p>",
        text: "2",
      },
      {
        to: "active2@example.com",
        subject: "Message 3",
        html: "<p>3</p>",
        text: "3",
      },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]?.status).toBe("sent");
    expect(results[1]?.status).toBe("suppressed");
    expect(results[2]?.status).toBe("sent");

    expect(memoryProvider.getSentEmails()).toHaveLength(2);
  });

  it("supports dynamic suppression and unsuppression via service", async () => {
    const memoryProvider = new MemoryEmailProvider();
    const service = createEmailService({
      config: {
        provider: "memory",
        defaultFrom: "notifications@lagan.dev",
      },
      provider: memoryProvider,
    });

    expect(await service.isSuppressed("user@example.com")).toBe(false);

    await service.suppress("user@example.com", "unsubscribe");
    expect(await service.isSuppressed("user@example.com")).toBe(true);

    const blockedResult = await service.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(blockedResult.status).toBe("suppressed");

    await service.unsuppress("user@example.com");
    expect(await service.isSuppressed("user@example.com")).toBe(false);

    const allowedResult = await service.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(allowedResult.status).toBe("sent");
  });
});
