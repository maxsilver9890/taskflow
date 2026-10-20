import type { PrismaClient } from "@prisma/client";

/** Keep an abandoned registration for seven days after its OTP expires. */
export const PENDING_REGISTRATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Limit each cleanup query so large backlogs do not create long transactions. */
export const PENDING_REGISTRATION_CLEANUP_BATCH_SIZE = 100;

/**
 * Delete one bounded batch of abandoned registrations.
 *
 * Both OTP expiry and row inactivity are checked again in deleteMany. A resend
 * that races with the initial selection updates otpExpiresAt/updatedAt, causing
 * the row to fail these atomic deletion predicates.
 */
export async function cleanupPendingRegistrations(
  db: PrismaClient,
  now = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - PENDING_REGISTRATION_RETENTION_MS);
  const candidates = await db.pendingRegistration.findMany({
    where: {
      otpExpiresAt: { lt: cutoff },
      updatedAt: { lt: cutoff }
    },
    select: { id: true },
    take: PENDING_REGISTRATION_CLEANUP_BATCH_SIZE
  });

  if (candidates.length === 0) return 0;

  const result = await db.pendingRegistration.deleteMany({
    where: {
      id: { in: candidates.map(({ id }) => id) },
      otpExpiresAt: { lt: cutoff },
      updatedAt: { lt: cutoff }
    }
  });
  return result.count;
}

export interface PendingRegistrationCleanupScheduler {
  /** Stop future runs and wait for the current run to settle. */
  stop: () => Promise<void>;
}

/** Start the daily cleanup loop. Failures are logged without database details. */
export function startPendingRegistrationCleanup(
  db: PrismaClient,
  logger: {
    info: (obj: Record<string, unknown>, msg: string) => void;
    error: (obj: Record<string, unknown>, msg: string) => void;
  },
  intervalMs = 24 * 60 * 60 * 1000
): PendingRegistrationCleanupScheduler {
  let stopped = false;
  let inFlight: Promise<void> | undefined;

  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const deletedCount = await cleanupPendingRegistrations(db);
        logger.info({ deletedCount }, "Pending-registration cleanup completed");
      } catch {
        // Prisma errors can include query details; keep this log free of row data.
        logger.error({}, "Pending-registration cleanup failed");
      }
    })().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);

  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    }
  };
}
