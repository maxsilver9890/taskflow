/**
 * Unit tests for the email-verification OTP flow (auth.service.ts:
 * verifyEmail / resendVerification), plus register() enqueue failure
 * handling for pending registrations.
 *
 * These tests do NOT require a live database — all Prisma calls are
 * replaced with vi.fn() stubs, mirroring auth.service.test.ts.
 *
 * Run with: npx vitest run tests/unit/email-verification.service.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import { hashToken, verifyAccessToken } from "../../src/lib/jwt.js";
import { register, resendVerification, verifyEmail } from "../../src/auth/auth.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    orgMember: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    emailVerificationOtp: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    pendingRegistration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as import("@prisma/client").PrismaClient;
}

function makeQueueStub() {
  return { add: vi.fn().mockResolvedValue({}) } as unknown as import("bullmq").Queue;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "00000000-0000-0000-0000-000000000002";
const AUTH = { userId: USER_ID, orgId: ORG_ID, role: "MEMBER" };

function unverifiedUser(overrides: Partial<{ id: string; email: string; name: string; emailVerified: boolean }> = {}) {
  return {
    id: USER_ID,
    email: "alice@example.com",
    name: "Alice",
    emailVerified: false,
    ...overrides
  };
}

/** A fresh, unexpired, never-attempted, never-consumed OTP row for `otp`. */
function activeOtpRow(otp: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "otp-row-1",
    userId: USER_ID,
    otpHash: hashToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: new Date(),
    ...overrides
  };
}

// ─── verifyEmail ────────────────────────────────────────────────────────────────

describe("auth.service — verifyEmail", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("verifies a valid, unexpired OTP: consumes it, marks the user verified, and issues a fresh token pair with emailVerified: true", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(activeOtpRow("123456"));
    (db.emailVerificationOtp.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await verifyEmail(db, AUTH, { otp: "123456" });

    expect(result.message).toMatch(/verified/i);
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(verifyAccessToken(result.accessToken)).toMatchObject({
      sub: USER_ID,
      orgId: ORG_ID,
      emailVerified: true
    });

    // The OTP row is consumed (single-use)...
    expect(db.emailVerificationOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-row-1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) })
      })
    );
    // ...and the user flipped to verified, stamped with a timestamp.
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ emailVerified: true, emailVerifiedAt: expect.any(Date) })
      })
    );

    // The raw code is never echoed back anywhere in the response.
    expect(JSON.stringify(result)).not.toContain("123456");
  });

  it("rejects a wrong code (OTP_INVALID) and increments the attempt counter on the active row", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(activeOtpRow("123456"));
    (db.emailVerificationOtp.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await expect(
      verifyEmail(db, AUTH, { otp: "000000" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });

    expect(db.emailVerificationOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-row-1" },
        data: { attempts: { increment: 1 } }
      })
    );
    // A wrong guess must never consume or verify anything.
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects an expired OTP (OTP_EXPIRED) without touching attempts", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      activeOtpRow("123456", { expiresAt: new Date(Date.now() - 1000) })
    );

    await expect(
      verifyEmail(db, AUTH, { otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_EXPIRED" });

    expect(db.emailVerificationOtp.update).not.toHaveBeenCalled();
  });

  it("rejects a reused (already-consumed) OTP as OTP_INVALID — a consumed row is never the 'active' row", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    // findActiveEmailVerificationOtp's real WHERE clause excludes
    // consumedAt-set rows, so a reused code surfaces as "no active row".
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      verifyEmail(db, AUTH, { otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("locks out further attempts once the max attempt count is reached (OTP_LOCKED), even with the correct code", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      activeOtpRow("123456", { attempts: 5 })
    );

    await expect(
      verifyEmail(db, AUTH, { otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_LOCKED" });

    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects when no OTP was ever issued (OTP_INVALID — identical to a wrong guess, no information leak)", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      verifyEmail(db, AUTH, { otp: "999999" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("rejects duplicate verification once already verified (EMAIL_ALREADY_VERIFIED), without touching any OTP row", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      unverifiedUser({ emailVerified: true })
    );

    await expect(
      verifyEmail(db, AUTH, { otp: "123456" })
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_VERIFIED" });

    expect(db.emailVerificationOtp.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the OTP lookup to the caller's own userId — never another user's", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(activeOtpRow("123456"));
    (db.emailVerificationOtp.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await verifyEmail(db, AUTH, { otp: "123456" });

    expect(db.emailVerificationOtp.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) })
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } })
    );
  });
});

// ─── resendVerification ─────────────────────────────────────────────────────────

describe("auth.service — resendVerification", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("issues and queues a new OTP, invalidating whatever was active before it, when no previous code exists", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no prior OTP at all
    (db.emailVerificationOtp.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (db.emailVerificationOtp.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const queue = makeQueueStub();

    const result = await resendVerification(db, queue, AUTH);

    expect(result.message).toMatch(/sent/i);
    expect(result.cooldownSeconds).toBe(60);

    expect(db.emailVerificationOtp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, consumedAt: null, invalidatedAt: null }),
        data: expect.objectContaining({ invalidatedAt: expect.any(Date) })
      })
    );
    expect(db.emailVerificationOtp.create).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "email_verification",
      expect.objectContaining({ type: "email_verification", data: expect.objectContaining({ userId: USER_ID }) })
    );
  });

  it("rejects within the 60s cooldown window (OTP_RESEND_COOLDOWN) and does not touch the OTP table or the queue", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      activeOtpRow("123456", { createdAt: new Date(Date.now() - 10 * 1000) }) // 10s ago
    );

    const queue = makeQueueStub();

    await expect(resendVerification(db, queue, AUTH)).rejects.toMatchObject({
      code: "OTP_RESEND_COOLDOWN",
      details: { retryAfterSeconds: expect.any(Number) }
    });

    expect(db.emailVerificationOtp.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("allows a resend once the cooldown has elapsed", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      activeOtpRow("123456", { createdAt: new Date(Date.now() - 61 * 1000) }) // 61s ago
    );
    (db.emailVerificationOtp.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.emailVerificationOtp.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const queue = makeQueueStub();

    await expect(resendVerification(db, queue, AUTH)).resolves.toMatchObject({
      message: expect.stringMatching(/sent/i)
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("rejects resend once already verified (EMAIL_ALREADY_VERIFIED)", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      unverifiedUser({ emailVerified: true })
    );
    const queue = makeQueueStub();

    await expect(resendVerification(db, queue, AUTH)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_VERIFIED"
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("generates a genuinely different code on every resend (never reuses the previous one)", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.emailVerificationOtp.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (db.emailVerificationOtp.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const queue = makeQueueStub();
      await resendVerification(db, queue, AUTH);
      const otp = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0][1].data.otp;
      expect(otp).toMatch(/^\d{6}$/);
      seen.add(otp);
    }
    // Overwhelmingly likely to differ at least once across 20 draws from a
    // 1,000,000-value CSPRNG space; a constant/predictable generator would
    // fail this immediately.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("swallows an email-queue failure (best-effort enqueue, matching task-assignment.service.ts's documented convention) rather than failing the whole request", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unverifiedUser());
    (db.emailVerificationOtp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.emailVerificationOtp.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (db.emailVerificationOtp.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const failingQueue = {
      add: vi.fn().mockRejectedValue(new Error("Redis connection lost"))
    } as unknown as import("bullmq").Queue;

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // The OTP row is already persisted — a transient queue outage must not
    // turn into a 500 for the caller (who already has a valid, if
    // undelivered, code — and can retry resend once the queue recovers).
    await expect(resendVerification(db, failingQueue, AUTH)).resolves.toMatchObject({
      message: expect.stringMatching(/sent/i)
    });
    expect(db.emailVerificationOtp.create).toHaveBeenCalledTimes(1);

    // But the failure IS logged (structured, WARN-level) so it's observable.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("enqueue_failed")
    );
    // Never logs the raw OTP or the user's email.
    const loggedPayload = consoleErrorSpy.mock.calls[0][0] as string;
    expect(loggedPayload).not.toContain("alice@example.com");

    consoleErrorSpy.mockRestore();
  });
});

// ─── register()'s email-queue failure handling ─────────────────────────────────

describe("auth.service — register (email queue failure)", () => {
  it("still creates a pending registration when the email queue is down — best-effort enqueue, not transactional with the DB write", async () => {
    const db = makePrismaMock();

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.pendingRegistration.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.pendingRegistration.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const failingQueue = {
      add: vi.fn().mockRejectedValue(new Error("Redis connection lost"))
    } as unknown as import("bullmq").Queue;

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await register(db, failingQueue, {
      email: "carol@example.com",
      name: "Carol",
      password: "plaintextpassword",
      organizationName: "Acme"
    });

    // The pending row exists so the caller can request a fresh code via
    // POST /auth/resend-registration once the queue recovers.
    expect(result).toMatchObject({ email: "carol@example.com", expiresInMinutes: 10 });
    expect("accessToken" in result).toBe(false);
    expect(db.pendingRegistration.upsert).toHaveBeenCalledTimes(1);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("enqueue_failed"));

    consoleErrorSpy.mockRestore();
  });
});
