/**
 * Email provider abstraction.
 *
 * In development/test the "console" provider logs emails to stdout and never
 * hits an external API.  In production set EMAIL_PROVIDER=resend and supply
 * RESEND_API_KEY + RESEND_FROM_ADDRESS to route real delivery through Resend.
 *
 * The abstraction is intentionally thin: swap providers by changing env vars,
 * without touching queue, worker, or processor code.
 *
 * ── Supported providers ──────────────────────────────────────────────────────
 *   console   Log to stdout (development / test default)
 *   resend    Resend transactional email API (production)
 */

import { Resend } from "resend";

// ── Message interface ────────────────────────────────────────────────────────

export interface EmailMessage {
  /** Recipient email address — validated before sending. */
  to: string;
  subject: string;
  /** Plain-text fallback body (required). */
  text: string;
  /** HTML body (optional).  Providers that support HTML will prefer this. */
  html?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

// ── Validation helper ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRecipient(to: string): void {
  if (!EMAIL_RE.test(to)) {
    throw new Error(`Invalid recipient email address: "${to}"`);
  }
}

// ── Console provider (development / test default) ────────────────────────────

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.EMAIL_PROVIDER === "console-fail") {
      throw new Error("Simulated email delivery failure");
    }

    validateRecipient(message.to);

    console.log(
      JSON.stringify({
        level: "info",
        service: "taskflow-worker",
        event: "email_sent",
        to: message.to,
        subject: message.subject,
        body: message.text,
        timestamp: new Date().toISOString()
      })
    );
  }
}

// ── Resend provider (production) ─────────────────────────────────────────────

class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    if (!apiKey) {
      throw new Error(
        "ResendEmailProvider requires RESEND_API_KEY to be set"
      );
    }
    if (!from) {
      throw new Error(
        "ResendEmailProvider requires RESEND_FROM_ADDRESS to be set"
      );
    }

    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    validateRecipient(message.to);

    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {})
    });

    if (error) {
      // Surface the provider error message but strip any credential details
      // that Resend might echo back in error metadata.
      throw new Error(`Resend delivery failed: ${error.message}`);
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  switch (provider) {
    case "console":
    case "console-fail":
      return new ConsoleEmailProvider();

    case "resend": {
      const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
      const from = process.env.RESEND_FROM_ADDRESS?.trim() ?? "";

      if (!apiKey) {
        throw new Error(
          "EMAIL_PROVIDER=resend requires RESEND_API_KEY to be set"
        );
      }
      if (!from) {
        throw new Error(
          "EMAIL_PROVIDER=resend requires RESEND_FROM_ADDRESS to be set"
        );
      }

      return new ResendEmailProvider(apiKey, from);
    }

    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER "${provider}". Supported values: console, resend`
      );
  }
}

// ── Re-export for tests that need to construct a provider directly ────────────
export { ResendEmailProvider, ConsoleEmailProvider };
