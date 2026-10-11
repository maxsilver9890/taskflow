/**
 * Central BullMQ queue configuration.
 *
 * Both the API (producer) and the worker (consumer) import from this module so
 * queue names, retry policy, and payload types stay in one place.
 *
 * ── Queue topology ───────────────────────────────────────────────────────────
 *
 *   taskflow:email        Main queue.  Jobs are enqueued here on assignment.
 *   taskflow:email:dlq    Explicit dead-letter queue.  The worker moves a job
 *                         here after all 3 attempts are exhausted.  The
 *                         original failed job remains in the main queue's
 *                         "failed" sorted set (BullMQ default) so it is still
 *                         queryable via its original job ID.
 *
 * ── Retry policy (per spec) ──────────────────────────────────────────────────
 *   attempt 1 → 1 s delay
 *   attempt 2 → 2 s delay
 *   attempt 3 → 4 s delay
 *
 * BullMQ's built-in exponential formula: delay × 2^(attemptsMade − 1)
 * Setting delay=1000 and attempts=3 produces exactly the required schedule.
 */

import { Queue } from "bullmq";
import type IORedis from "ioredis";

// ── Queue names ──────────────────────────────────────────────────────────────

export const EMAIL_QUEUE_NAME = "taskflow-email";

/**
 * Explicit dead-letter queue.
 * Jobs are added here by the worker after all retry attempts are exhausted.
 * DLQ entries never expire so they can be inspected or replayed by operators.
 */
export const EMAIL_DLQ_NAME = "taskflow-email-dlq";

// ── Job payload types ────────────────────────────────────────────────────────

export interface TaskAssignedPayload {
  /** The user who was assigned to the task. */
  assigneeId: string;
  assigneeEmail: string;
  assigneeName: string;

  taskId: string;
  taskTitle: string;

  projectId: string;
  projectName: string;

  /**
   * Tenant scope.  Used by GET /jobs/:id to enforce cross-tenant isolation:
   * a request authenticated for org A must not be able to read job metadata
   * that belongs to org B.
   */
  organizationId: string;
}

export interface PasswordResetPayload {
  userId: string;
  email: string;
  name: string;
  /** Fully-formed link the user clicks; carries the raw (unhashed) reset token. */
  resetUrl: string;
}
export interface OrganizationInvitationPayload {
  invitationId: string;
  email: string;
  name: string;
  organizationName: string;
  inviteUrl: string;
}

export interface EmailVerificationPayload {
  userId?: string;
  email: string;
  name: string;
  /**
   * The raw 6-digit code. Only ever lives here in-flight through Redis on
   * its way to the email provider — never persisted anywhere; the DB only
   * ever stores its SHA-256 hash (see EmailVerificationOtp).
   */
  otp: string;
  expiresInMinutes: number;
}

export type EmailJobPayload =
  | {
      type: "task_assigned";
      data: TaskAssignedPayload;
    }
  | {
      type: "password_reset";
      data: PasswordResetPayload;
    }
  | {
      type: "organization_invitation";
      data: OrganizationInvitationPayload;
    }
  | {
      type: "email_verification";
      data: EmailVerificationPayload;
    };

/**
 * DLQ entry shape.  Mirrors the original job payload and adds failure context
 * so operators can understand why a job landed in the DLQ without reading raw
 * Redis keys.
 */
export interface DlqEntry {
  originalJobId: string | undefined;
  enqueuedAt: string; // ISO-8601 timestamp of when the DLQ entry was created
  failedReason: string;
  attemptsMade: number;
  payload: EmailJobPayload;
}

// ── Default job options ──────────────────────────────────────────────────────

/**
 * Exponential-backoff schedule matching the spec:
 *   attempt 1: 1 000 ms
 *   attempt 2: 2 000 ms
 *   attempt 3: 4 000 ms
 */
export const EMAIL_JOB_DEFAULT_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000 // 1 s → 2 s → 4 s
  },
  removeOnComplete: {
    // Keep completed jobs for 24 h so GET /jobs/:id can report "completed".
    age: 86400
  },
  // Never auto-delete failed jobs — they remain in the "failed" sorted set
  // so GET /jobs/:id can still report "failed" via the original job ID.
  removeOnFail: false
} as const;

// ── Factories ────────────────────────────────────────────────────────────────

export function createEmailQueue(connection: IORedis): Queue<EmailJobPayload> {
  return new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
    connection,
    defaultJobOptions: EMAIL_JOB_DEFAULT_OPTIONS
  });
}

/**
 * Creates the explicit DLQ.  DLQ jobs are regular BullMQ jobs on a separate
 * queue so they can be inspected, replayed, or bulk-deleted independently of
 * the main queue's failed set.  They never expire (`removeOnComplete: false`,
 * `removeOnFail: false`).
 */
export function createEmailDlq(connection: IORedis): Queue<DlqEntry> {
  return new Queue<DlqEntry>(EMAIL_DLQ_NAME, {
    connection,
    defaultJobOptions: {
      // DLQ entries should never be retried automatically.
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false
    }
  });
}
