import type { SuppressionStore } from "./types";

export type EmailProviderType = "logger" | "dev" | "resend" | "ses" | "smtp" | "memory" | "test";

export interface ResendConfig {
  apiKey: string;
  baseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export interface SesConfig {
  region?: string | undefined;
  endpoint?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean | undefined;
  auth?:
    | {
        user: string;
        pass: string;
      }
    | undefined;
}

export interface EmailConfig {
  provider: EmailProviderType;
  defaultFrom: string;
  replyTo?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  resend?: ResendConfig | undefined;
  ses?: SesConfig | undefined;
  smtp?: SmtpConfig | undefined;
  suppressionStore?: SuppressionStore | undefined;
}

export function loadEmailConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): EmailConfig {
  const rawProvider = env.EMAIL_PROVIDER?.trim().toLowerCase();
  const provider: EmailProviderType =
    rawProvider === "resend" ||
    rawProvider === "ses" ||
    rawProvider === "smtp" ||
    rawProvider === "memory" ||
    rawProvider === "test" ||
    rawProvider === "dev"
      ? rawProvider
      : "logger";

  const defaultFrom = env.EMAIL_FROM?.trim() || "Lagan <notifications@lagan.dev>";
  const replyTo = env.EMAIL_REPLY_TO?.trim() || undefined;
  const appName = env.APP_NAME?.trim() || "Lagan";
  const appUrl = env.APP_URL?.trim() || "http://localhost:3000";

  const config: EmailConfig = {
    provider,
    defaultFrom,
    replyTo,
    appName,
    appUrl,
  };

  const resendApiKey = env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    config.resend = {
      apiKey: resendApiKey,
      baseUrl: env.RESEND_BASE_URL?.trim() || undefined,
    };
  }

  const sesRegion = env.SES_REGION?.trim() || env.AWS_REGION?.trim();
  if (sesRegion || env.SES_ENDPOINT) {
    config.ses = {
      region: sesRegion,
      endpoint: env.SES_ENDPOINT?.trim() || undefined,
      accessKeyId: env.AWS_ACCESS_KEY_ID?.trim() || undefined,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY?.trim() || undefined,
    };
  }

  const smtpHost = env.SMTP_HOST?.trim();
  if (smtpHost) {
    const smtpPort = Number.parseInt(env.SMTP_PORT?.trim() || "587", 10);
    const smtpUser = env.SMTP_USER?.trim();
    const smtpPass = env.SMTP_PASS?.trim();
    config.smtp = {
      host: smtpHost,
      port: Number.isNaN(smtpPort) ? 587 : smtpPort,
      secure: env.SMTP_SECURE === "true" || smtpPort === 465,
      auth:
        smtpUser && smtpPass
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
    };
  }

  return config;
}
