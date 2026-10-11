/**
 * Job status service.
 *
 * Translates BullMQ job state into the public status vocabulary required by
 * the spec:  pending | active | completed | failed
 *
 * BullMQ internal states:
 *   waiting / delayed / prioritized  → pending
 *   active                           → active
 *   completed                        → completed
 *   failed                           → failed
 *   unknown (not found)              → null
 *
 * ── Tenant isolation ─────────────────────────────────────────────────────────
 * Every email job payload carries an `organizationId` field (set at enqueue
 * time in task-assignment.service.ts).  `getJobStatus` compares it against the
 * caller's `requestingOrgId` and returns `null` when they differ, causing the
 * controller to emit 403 — without leaking any data about the other org's job.
 */

import type { Queue } from "bullmq";

import type { EmailJobPayload } from "./queue.js";

export type PublicJobStatus = "pending" | "active" | "completed" | "failed";

export interface JobStatusResponse {
  jobId: string;
  status: PublicJobStatus;
  type: string | null;
  /** ISO-8601 timestamp of when the job was added to the queue. */
  createdAt: string | null;
  /** ISO-8601 timestamp of the last state transition (finished/failed). */
  finishedAt: string | null;
  /** Number of processing attempts made so far. */
  attemptsMade: number;
  /** Reason for the last failure, if any. */
  failedReason: string | null;
}

/**
 * Sentinel returned when a job exists but belongs to a different org.
 * The controller maps this to 403 without exposing the job's data.
 */
export const FORBIDDEN_JOB = Symbol("FORBIDDEN_JOB");

function mapBullMqState(state: string): PublicJobStatus {
  switch (state) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    // waiting, delayed, prioritized, wait-children → queued but not yet running
    default:
      return "pending";
  }
}

/**
 * @param queue            The main email queue (taskflow:email).
 * @param jobId            The job ID from the URL param.
 * @param requestingOrgId  The org ID from `req.auth.orgId` (never client-supplied).
 *
 * @returns JobStatusResponse   — job found and belongs to requestingOrgId
 * @returns FORBIDDEN_JOB       — job found but belongs to a different org (→ 403)
 * @returns null                — job not found (→ 404)
 */
export async function getJobStatus(
  queue: Queue<EmailJobPayload>,
  jobId: string,
  requestingOrgId: string
): Promise<JobStatusResponse | typeof FORBIDDEN_JOB | null> {
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  // ── Tenant isolation check ────────────────────────────────────────────────
  // organizationId is embedded in task_assigned payloads at enqueue time. We
  // compare it against the JWT-derived org rather than any client-supplied
  // value, making cross-tenant probing impossible. Other job types (e.g.
  // password_reset) carry no organizationId — GET /jobs/:id isn't part of
  // that flow, so they're denied by default rather than compared against
  // nothing.
  const jobData = job.data as EmailJobPayload;
  const jobOrgId =
    jobData.type === "task_assigned" ? jobData.data.organizationId : undefined;

  if (jobOrgId !== requestingOrgId) {
    // Return the sentinel instead of throwing so the controller decides the
    // HTTP status code, keeping service-layer concerns separate.
    return FORBIDDEN_JOB;
  }

  const rawState = await job.getState();
  const status = mapBullMqState(rawState);

  return {
    jobId: job.id ?? jobId,
    status,
    type: (job.data as EmailJobPayload).type ?? null,
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason ?? null
  };
}
