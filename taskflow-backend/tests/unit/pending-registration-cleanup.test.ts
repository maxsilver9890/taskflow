import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupPendingRegistrations,
  PENDING_REGISTRATION_CLEANUP_BATCH_SIZE,
  PENDING_REGISTRATION_RETENTION_MS,
  startPendingRegistrationCleanup
} from "../../src/auth/pending-registration-cleanup.js";

function makeDb() {
  return {
    pendingRegistration: {
      findMany: vi.fn(),
      deleteMany: vi.fn()
    }
  } as unknown as import("@prisma/client").PrismaClient;
}

describe("pending registration cleanup", () => {
  afterEach(() => vi.useRealTimers());

  it("deletes a bounded batch whose OTP and row have both been expired/inactive for the retention window", async () => {
    const db = makeDb();
    const now = new Date("2026-10-21T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - PENDING_REGISTRATION_RETENTION_MS);
    const findMany = db.pendingRegistration.findMany as ReturnType<typeof vi.fn>;
    const deleteMany = db.pendingRegistration.deleteMany as ReturnType<typeof vi.fn>;
    findMany.mockResolvedValue([{ id: "pending-1" }]);
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(cleanupPendingRegistrations(db, now)).resolves.toBe(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { otpExpiresAt: { lt: cutoff }, updatedAt: { lt: cutoff } },
      select: { id: true },
      take: PENDING_REGISTRATION_CLEANUP_BATCH_SIZE
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["pending-1"] },
        otpExpiresAt: { lt: cutoff },
        updatedAt: { lt: cutoff }
      }
    });
  });

  it("preserves a row resent after candidate selection because deletion rechecks current expiry and activity", async () => {
    const db = makeDb();
    const now = new Date("2026-10-21T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - PENDING_REGISTRATION_RETENTION_MS);
    const findMany = db.pendingRegistration.findMany as ReturnType<typeof vi.fn>;
    const deleteMany = db.pendingRegistration.deleteMany as ReturnType<typeof vi.fn>;
    findMany.mockResolvedValue([{ id: "recently-resent" }]);
    // The database's atomic predicates no longer match after resend updates the row.
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(cleanupPendingRegistrations(db, now)).resolves.toBe(0);
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        otpExpiresAt: { lt: cutoff },
        updatedAt: { lt: cutoff }
      })
    }));
  });

  it("does not issue a delete when no expired candidates exist", async () => {
    const db = makeDb();
    const findMany = db.pendingRegistration.findMany as ReturnType<typeof vi.fn>;
    const deleteMany = db.pendingRegistration.deleteMany as ReturnType<typeof vi.fn>;
    findMany.mockResolvedValue([]);

    await expect(cleanupPendingRegistrations(db)).resolves.toBe(0);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("propagates database failures from the cleanup operation", async () => {
    const db = makeDb();
    (db.pendingRegistration.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("database failure"));

    await expect(cleanupPendingRegistrations(db)).rejects.toThrow("database failure");
  });

  it("logs scheduled cleanup failures without logging database error details", async () => {
    vi.useFakeTimers();
    const db = makeDb();
    (db.pendingRegistration.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("sensitive query details"));
    const logger = { info: vi.fn(), error: vi.fn() };
    const scheduler = startPendingRegistrationCleanup(db, logger, 60_000);

    await scheduler.stop();
    expect(logger.error).toHaveBeenCalledWith({}, "Pending-registration cleanup failed");
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("sensitive query details");
  });

  it("runs once at startup and once per interval, then prevents later runs after stop", async () => {
    vi.useFakeTimers();
    const db = makeDb();
    (db.pendingRegistration.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const scheduler = startPendingRegistrationCleanup(db, { info: vi.fn(), error: vi.fn() }, 60_000);

    expect(db.pendingRegistration.findMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.pendingRegistration.findMany).toHaveBeenCalledTimes(2);

    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(db.pendingRegistration.findMany).toHaveBeenCalledTimes(2);
  });

  it("waits for an in-flight cleanup to settle before stopping", async () => {
    let finishQuery: ((rows: never[]) => void) | undefined;
    const db = makeDb();
    (db.pendingRegistration.findMany as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => { finishQuery = resolve; })
    );
    const scheduler = startPendingRegistrationCleanup(db, { info: vi.fn(), error: vi.fn() });

    let stopped = false;
    const stopping = scheduler.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);

    finishQuery!([]);
    await stopping;
    expect(stopped).toBe(true);
  });
});
