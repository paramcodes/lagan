import { describe, expect, it, vi } from "vitest";
import {
  createEmailProvider,
  DevLoggerProvider,
  formatRecipient,
  getRecipientEmail,
  MemoryEmailProvider,
  ResendEmailProvider,
  SesEmailProvider,
  SmtpEmailProvider,
} from "./providers";
import type { EmailMessage } from "./types";

describe("Email Providers", () => {
  describe("formatRecipient & getRecipientEmail", () => {
    it("formats string and object recipients", () => {
      expect(formatRecipient("test@example.com")).toBe("test@example.com");
      expect(formatRecipient({ name: "Alice", email: "alice@example.com" })).toBe(
        "Alice <alice@example.com>",
      );
      expect(formatRecipient({ email: "bob@example.com" })).toBe("bob@example.com");

      expect(getRecipientEmail("test@example.com")).toBe("test@example.com");
      expect(getRecipientEmail({ name: "Alice", email: "alice@example.com" })).toBe(
        "alice@example.com",
      );
    });
  });

  describe("DevLoggerProvider", () => {
    it("logs message and returns successful result", async () => {
      const logs: string[] = [];
      const provider = new DevLoggerProvider({
        logFn: (msg) => logs.push(msg),
      });

      const message: EmailMessage = {
        to: "student@example.edu",
        from: "Lagan <notifications@lagan.dev>",
        subject: "Welcome to Class",
        text: "Here is your syllabus.",
        html: "<p>Here is your syllabus.</p>",
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.status).toBe("sent");
      expect(result.provider).toBe("dev-logger");
      expect(result.recipient).toBe("student@example.edu");
      expect(result.messageId).toMatch(/^dev_/);

      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("LAGAN EMAIL DEV LOGGER");
      expect(logs[0]).toContain("student@example.edu");
      expect(logs[0]).toContain("Welcome to Class");
      expect(logs[0]).toContain("Here is your syllabus.");
    });
  });

  describe("MemoryEmailProvider", () => {
    it("stores sent messages in memory for inspection", async () => {
      const provider = new MemoryEmailProvider();

      const message1: EmailMessage = {
        to: "one@example.com",
        from: "notifications@lagan.dev",
        subject: "First",
        html: "<p>1</p>",
        text: "1",
      };

      const message2: EmailMessage = {
        to: "two@example.com",
        from: "notifications@lagan.dev",
        subject: "Second",
        html: "<p>2</p>",
        text: "2",
      };

      await provider.send(message1);
      await provider.send(message2);

      expect(provider.getSentEmails()).toHaveLength(2);
      expect(provider.getLastEmail()?.subject).toBe("Second");
      expect(provider.findEmail((m) => m.to === "one@example.com")?.subject).toBe("First");

      provider.clear();
      expect(provider.getSentEmails()).toHaveLength(0);
      expect(provider.getLastEmail()).toBeUndefined();
    });
  });

  describe("ResendEmailProvider", () => {
    it("throws when initialized without apiKey", () => {
      expect(() => new ResendEmailProvider({ apiKey: "" })).toThrow("requires an apiKey");
    });

    it("sends request with correct authorization and payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "resend_msg_123" }),
      });

      const provider = new ResendEmailProvider({
        apiKey: "re_test_key_123",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const message: EmailMessage = {
        to: { name: "Learner", email: "learner@example.com" },
        from: "Lagan <notify@lagan.dev>",
        replyTo: "support@lagan.dev",
        subject: "Course Update",
        html: "<p>New lesson available</p>",
        text: "New lesson available",
        headers: { "X-Entity-Ref-ID": "12345" },
        tags: { category: "notifications" },
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("resend_msg_123");
      expect(result.status).toBe("sent");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_test_key_123",
            "Content-Type": "application/json",
          }),
        }),
      );

      const callOptions = mockFetch.mock.calls[0]?.[1] as { body: string } | undefined;
      expect(callOptions).toBeDefined();
      const requestBody = JSON.parse(callOptions?.body ?? "{}");
      expect(requestBody.to).toEqual(["Learner <learner@example.com>"]);
      expect(requestBody.from).toBe("Lagan <notify@lagan.dev>");
      expect(requestBody.reply_to).toBe("support@lagan.dev");
      expect(requestBody.headers).toEqual({ "X-Entity-Ref-ID": "12345" });
      expect(requestBody.tags).toEqual([{ name: "category", value: "notifications" }]);
    });

    it("handles Resend API error responses", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          statusCode: 422,
          message: "Domain not verified",
        }),
      });

      const provider = new ResendEmailProvider({
        apiKey: "re_test_key_123",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.send({
        to: "user@example.com",
        from: "notify@unverified.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toBe("Domain not verified");
    });
  });

  describe("SesEmailProvider", () => {
    it("sends request to SES endpoint and handles response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ MessageId: "ses_msg_987" }),
      });

      const provider = new SesEmailProvider({
        region: "eu-west-1",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const message: EmailMessage = {
        to: "user@example.com",
        from: "Lagan <system@lagan.dev>",
        subject: "Notice",
        html: "<p>Hello</p>",
        text: "Hello",
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("ses_msg_987");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails",
        expect.anything(),
      );
    });

    it("handles SES API errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Rate limit exceeded" }),
      });

      const provider = new SesEmailProvider({
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.send({
        to: "user@example.com",
        from: "Lagan <system@lagan.dev>",
        subject: "Notice",
        html: "<p>Hello</p>",
        text: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });
  });

  describe("SmtpEmailProvider", () => {
    it("uses transport function when provided", async () => {
      const transport = vi.fn().mockResolvedValue({ messageId: "smtp_custom_456" });
      const provider = new SmtpEmailProvider({
        config: { host: "mail.example.com", port: 587 },
        transport,
      });

      const result = await provider.send({
        to: "user@example.com",
        from: "system@example.com",
        subject: "Subject",
        html: "<p>body</p>",
        text: "body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("smtp_custom_456");
      expect(transport).toHaveBeenCalled();
    });

    it("uses default transport when transport is omitted", async () => {
      const provider = new SmtpEmailProvider({
        host: "smtp.example.com",
        port: 587,
      });

      const result = await provider.send({
        to: "user@example.com",
        from: "system@example.com",
        subject: "Subject",
        html: "<p>body</p>",
        text: "body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain("@smtp.example.com>");
    });
  });

  describe("createEmailProvider factory", () => {
    it("creates logger provider by default", () => {
      const provider = createEmailProvider({
        provider: "logger",
        defaultFrom: "test@example.com",
      });
      expect(provider.name).toBe("dev-logger");
    });

    it("creates memory provider for test environments", () => {
      const provider = createEmailProvider({
        provider: "memory",
        defaultFrom: "test@example.com",
      });
      expect(provider.name).toBe("memory");
    });

    it("throws if resend selected without config", () => {
      expect(() =>
        createEmailProvider({
          provider: "resend",
          defaultFrom: "test@example.com",
        }),
      ).toThrow("no 'resend' configuration provided");
    });
  });
});
