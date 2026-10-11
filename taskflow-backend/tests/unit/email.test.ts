/**
 * Unit tests for the email provider abstraction.
 *
 * Covers:
 *   - ConsoleEmailProvider: successful send, console-fail simulation
 *   - createEmailProvider: factory routing (console, resend, unknown, missing config)
 *   - ResendEmailProvider: successful path (mocked SDK), provider error → throws
 *   - Recipient validation: invalid address rejected before any provider call
 *   - DLQ flow via email processor: exhausted job is forwarded to the DLQ queue
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Resend SDK mock ──────────────────────────────────────────────────────────
// We mock the module before importing email.ts so the factory receives the mock.

const mockResendSend = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: mockResendSend
      }
    }))
  };
});

// ── Import under test ────────────────────────────────────────────────────────
import {
  ConsoleEmailProvider,
  ResendEmailProvider,
  createEmailProvider
} from "../../src/lib/email.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const validMessage = {
  to: "user@example.com",
  subject: "Test subject",
  text: "Hello world"
};

const validMessageWithHtml = {
  ...validMessage,
  html: "<p>Hello <strong>world</strong></p>"
};

// ── ConsoleEmailProvider ─────────────────────────────────────────────────────

describe("ConsoleEmailProvider", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.EMAIL_PROVIDER;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.EMAIL_PROVIDER;
  });

  it("logs a structured JSON entry on successful send", async () => {
    const provider = new ConsoleEmailProvider();
    await provider.send(validMessage);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("email_sent");
    expect(logged.to).toBe(validMessage.to);
    expect(logged.subject).toBe(validMessage.subject);
  });

  it("logs a structured JSON entry when html is provided", async () => {
    const provider = new ConsoleEmailProvider();
    await provider.send(validMessageWithHtml);

    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it("throws when EMAIL_PROVIDER=console-fail (simulated failure)", async () => {
    process.env.EMAIL_PROVIDER = "console-fail";
    const provider = new ConsoleEmailProvider();

    await expect(provider.send(validMessage)).rejects.toThrow(
      "Simulated email delivery failure"
    );
  });

  it("throws for an invalid recipient email address", async () => {
    const provider = new ConsoleEmailProvider();

    await expect(
      provider.send({ ...validMessage, to: "not-an-email" })
    ).rejects.toThrow("Invalid recipient email address");
  });

  it("throws for an empty recipient email address", async () => {
    const provider = new ConsoleEmailProvider();

    await expect(
      provider.send({ ...validMessage, to: "" })
    ).rejects.toThrow("Invalid recipient email address");
  });
});

// ── ResendEmailProvider ──────────────────────────────────────────────────────

describe("ResendEmailProvider", () => {
  beforeEach(() => {
    mockResendSend.mockReset();
  });

  it("calls the Resend SDK with the correct parameters (text only)", async () => {
    mockResendSend.mockResolvedValue({ data: { id: "msg_123" }, error: null });
    const provider = new ResendEmailProvider(
      "re_test_key",
      "TaskFlow <noreply@example.com>"
    );

    await provider.send(validMessage);

    expect(mockResendSend).toHaveBeenCalledWith({
      from: "TaskFlow <noreply@example.com>",
      to: validMessage.to,
      subject: validMessage.subject,
      text: validMessage.text
    });
  });

  it("passes html when provided", async () => {
    mockResendSend.mockResolvedValue({ data: { id: "msg_456" }, error: null });
    const provider = new ResendEmailProvider(
      "re_test_key",
      "TaskFlow <noreply@example.com>"
    );

    await provider.send(validMessageWithHtml);

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ html: validMessageWithHtml.html })
    );
  });

  it("throws a sanitized error when the Resend API returns an error object", async () => {
    mockResendSend.mockResolvedValue({
      data: null,
      error: { message: "API key invalid", name: "validation_error", statusCode: 401 }
    });
    const provider = new ResendEmailProvider(
      "re_bad_key",
      "noreply@example.com"
    );

    await expect(provider.send(validMessage)).rejects.toThrow(
      "Resend delivery failed: API key invalid"
    );
  });

  it("propagates network / SDK errors as-is", async () => {
    mockResendSend.mockRejectedValue(new Error("Network timeout"));
    const provider = new ResendEmailProvider(
      "re_test_key",
      "noreply@example.com"
    );

    await expect(provider.send(validMessage)).rejects.toThrow("Network timeout");
  });

  it("throws for an invalid recipient before calling the SDK", async () => {
    const provider = new ResendEmailProvider(
      "re_test_key",
      "noreply@example.com"
    );

    await expect(
      provider.send({ ...validMessage, to: "@@bad" })
    ).rejects.toThrow("Invalid recipient email address");

    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("throws during construction when apiKey is empty", () => {
    expect(() => new ResendEmailProvider("", "noreply@example.com")).toThrow(
      "RESEND_API_KEY"
    );
  });

  it("throws during construction when from address is empty", () => {
    expect(() => new ResendEmailProvider("re_test_key", "")).toThrow(
      "RESEND_FROM_ADDRESS"
    );
  });
});

// ── createEmailProvider factory ──────────────────────────────────────────────

describe("createEmailProvider", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("returns a ConsoleEmailProvider when EMAIL_PROVIDER=console", () => {
    process.env.EMAIL_PROVIDER = "console";
    const provider = createEmailProvider();
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("returns a ConsoleEmailProvider when EMAIL_PROVIDER=console-fail", () => {
    process.env.EMAIL_PROVIDER = "console-fail";
    const provider = createEmailProvider();
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("returns a ConsoleEmailProvider by default (no EMAIL_PROVIDER set)", () => {
    delete process.env.EMAIL_PROVIDER;
    const provider = createEmailProvider();
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("returns a ResendEmailProvider when EMAIL_PROVIDER=resend with valid config", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_ADDRESS = "TaskFlow <noreply@example.com>";
    const provider = createEmailProvider();
    expect(provider).toBeInstanceOf(ResendEmailProvider);
  });

  it("throws when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing", () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_ADDRESS = "noreply@example.com";

    expect(() => createEmailProvider()).toThrow("RESEND_API_KEY");
  });

  it("throws when EMAIL_PROVIDER=resend but RESEND_FROM_ADDRESS is missing", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM_ADDRESS;

    expect(() => createEmailProvider()).toThrow("RESEND_FROM_ADDRESS");
  });

  it("throws for an unknown EMAIL_PROVIDER value", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    expect(() => createEmailProvider()).toThrow(
      'Unknown EMAIL_PROVIDER "sendgrid"'
    );
  });
});

// ── DLQ forwarding via email processor ───────────────────────────────────────

describe("createEmailWorker — DLQ forwarding on exhausted job", () => {
  /**
   * We test the DLQ forwarding logic indirectly by inspecting the "failed"
   * event handler registered on the worker.  Rather than spinning up a real
   * Redis connection, we extract the handler and invoke it directly.
   */
  it("adds a DLQ entry when a job is exhausted (attemptsMade >= attempts)", async () => {
    // Dynamically import to get a fresh module (isolate: true covers it per-file
    // but within one file we need direct import)
    const mockProvider = { send: vi.fn() };
    const mockDlq = { add: vi.fn().mockResolvedValue(undefined) };

    const failedHandlers: Array<(job: unknown, err: Error) => void> = [];

    // Stub BullMQ Worker to capture event handlers without touching Redis
    const mockWorkerInstance = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "failed") {
          failedHandlers.push(handler as (job: unknown, err: Error) => void);
        }
      })
    };

    vi.doMock("bullmq", () => ({
      Worker: vi.fn().mockImplementation(() => mockWorkerInstance)
    }));

    // Re-import after mock
    vi.resetModules();
    const { createEmailWorker: createEmailWorkerFresh } = await import(
      "../../src/jobs/email.processor.js?bust=" + Date.now()
    );

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    createEmailWorkerFresh(
      {} as never,
      mockProvider,
      mockDlq as never,
      logger
    );

    // Simulate exhausted job
    const fakeJob = {
      id: "job-1",
      data: {
        type: "task_assigned",
        data: {
          assigneeId: "u1",
          assigneeEmail: "a@b.com",
          assigneeName: "Alice",
          taskId: "t1",
          taskTitle: "Implement login",
          projectId: "p1",
          projectName: "Alpha",
          organizationId: "org1"
        }
      },
      opts: { attempts: 3 },
      attemptsMade: 3
    };

    const exhaustionErr = new Error("Provider unavailable");
    failedHandlers[0]?.(fakeJob, exhaustionErr);

    // Allow the fire-and-forget dlq.add() to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(mockDlq.add).toHaveBeenCalledWith(
      "dlq:task_assigned",
      expect.objectContaining({
        originalJobId: "job-1",
        failedReason: "Provider unavailable",
        attemptsMade: 3,
        payload: fakeJob.data
      })
    );

    vi.doUnmock("bullmq");
  });

  it("does NOT add a DLQ entry for an intermediate failed attempt", async () => {
    const mockProvider = { send: vi.fn() };
    const mockDlq = { add: vi.fn().mockResolvedValue(undefined) };

    const failedHandlers: Array<(job: unknown, err: Error) => void> = [];

    const mockWorkerInstance = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "failed") {
          failedHandlers.push(handler as (job: unknown, err: Error) => void);
        }
      })
    };

    vi.doMock("bullmq", () => ({
      Worker: vi.fn().mockImplementation(() => mockWorkerInstance)
    }));

    vi.resetModules();
    const { createEmailWorker: createEmailWorkerFresh } = await import(
      "../../src/jobs/email.processor.js?bust=" + Date.now() + "b"
    );

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    createEmailWorkerFresh(
      {} as never,
      mockProvider,
      mockDlq as never,
      logger
    );

    const fakeJob = {
      id: "job-2",
      data: { type: "task_assigned", data: {} },
      opts: { attempts: 3 },
      attemptsMade: 1 // attempt 1 of 3 — not yet exhausted
    };

    failedHandlers[0]?.(fakeJob, new Error("Transient error"));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockDlq.add).not.toHaveBeenCalled();

    vi.doUnmock("bullmq");
  });
});
