/**
 * BullMQ email job processor.
 *
 * Imported by the worker process (worker/worker.ts).  Never imported by the
 * API server — processor logic stays separate from request handling.
 *
 * ── Retry & DLQ flow ─────────────────────────────────────────────────────────
 *
 *   1. Job enters taskflow:email queue.
 *   2. Worker picks it up and calls emailProvider.send().
 *   3. On failure BullMQ re-queues with exponential back-off (1 s → 2 s → 4 s).
 *   4. After attempt 3 fails:
 *        a. BullMQ marks the job "failed" in the main queue's sorted set.
 *           The original job is RETAINED (removeOnFail: false) so it remains
 *           queryable at GET /jobs/:id with status "failed".
 *        b. The worker's "failed" event handler detects exhaustion
 *           (attemptsMade >= attempts) and adds a DLQ entry to the explicit
 *           taskflow:email:dlq queue with full failure context.
 *        c. The DLQ entry never expires and is never retried automatically.
 *
 * This two-pronged approach means:
 *   • The original job ID returned at assignment time always resolves via
 *     GET /jobs/:id (the main queue retains it).
 *   • Operators get a clean, explicit DLQ queue that is independent of the
 *     main queue's internal failed sorted set and can be inspected or bulk-
 *     replayed without touching the main queue.
 */

import { Worker } from "bullmq";
import type { Queue } from "bullmq";
import type IORedis from "ioredis";

import type { EmailProvider } from "../lib/email.js";
import type { DlqEntry, EmailJobPayload } from "./queue.js";
import { EMAIL_QUEUE_NAME } from "./queue.js";

// ── HTML email templates ─────────────────────────────────────────────────────

function htmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { background: #18181b; padding: 24px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
    .header .logo { color: #a1a1aa; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px; color: #27272a; font-size: 15px; line-height: 1.6; }
    .content p { margin: 0 0 16px; }
    .detail-box { background: #f4f4f5; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .detail-box .label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .detail-box .value { font-size: 15px; font-weight: 600; color: #18181b; }
    .btn { display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; margin: 8px 0 20px; }
    .footer { border-top: 1px solid #f4f4f5; padding: 20px 32px; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">TaskFlow</div>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="content">
      ${body}
    </div>
    <div class="footer">
      This email was sent by TaskFlow. If you did not expect it, you can safely ignore it.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function taskAssignedHtml(params: {
  assigneeName: string;
  taskTitle: string;
  projectName: string;
  frontendUrl: string;
  taskId: string;
}): string {
  const { assigneeName, taskTitle, projectName, frontendUrl, taskId } = params;
  const taskUrl = `${frontendUrl}/tasks/${taskId}`;

  const body = `
    <p>Hi ${escapeHtml(assigneeName)},</p>
    <p>You have been assigned to a task in <strong>${escapeHtml(projectName)}</strong>.</p>
    <div class="detail-box">
      <div class="label">Task</div>
      <div class="value">${escapeHtml(taskTitle)}</div>
    </div>
    <div class="detail-box">
      <div class="label">Project</div>
      <div class="value">${escapeHtml(projectName)}</div>
    </div>
    <p><a href="${escapeHtml(taskUrl)}" class="btn">View Task</a></p>
    <p>Log in to TaskFlow to see full details, leave a comment, or update the status.</p>
    <p>— The TaskFlow team</p>
  `;

  return htmlWrapper(`You've been assigned to: ${taskTitle}`, body);
}

function passwordResetHtml(params: {
  name: string;
  resetUrl: string;
}): string {
  const { name, resetUrl } = params;

  const body = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your TaskFlow password. Click the button below to choose a new one.</p>
    <p><a href="${escapeHtml(resetUrl)}" class="btn">Reset Password</a></p>
    <p>This link expires in <strong>1 hour</strong> and can only be used once.</p>
    <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    <p>— The TaskFlow team</p>
  `;

  return htmlWrapper("Reset your TaskFlow password", body);
}

function organizationInvitationHtml(params: {
  name: string;
  organizationName: string;
  inviteUrl: string;
}): string {
  const { name, organizationName, inviteUrl } = params;

  const body = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You have been invited to join <strong>${escapeHtml(organizationName)}</strong> on TaskFlow.</p>
    <p><a href="${escapeHtml(inviteUrl)}" class="btn">Accept Invitation</a></p>
    <p>This invitation expires in <strong>7 days</strong>. If you don't have a TaskFlow account, you'll be prompted to create one.</p>
    <p>— The TaskFlow team</p>
  `;

  return htmlWrapper(`Join ${organizationName} on TaskFlow`, body);
}

function emailVerificationHtml(params: {
  name: string;
  otp: string;
  expiresInMinutes: number;
}): string {
  const { name, otp, expiresInMinutes } = params;

  const body = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Use the code below to verify your email address and finish setting up your TaskFlow account.</p>
    <div class="detail-box">
      <div class="label">Verification code</div>
      <div class="value" style="font-size: 28px; letter-spacing: 6px;">${escapeHtml(otp)}</div>
    </div>
    <p>This code expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.</p>
    <p>If you didn't create a TaskFlow account, you can safely ignore this email.</p>
    <p>— The TaskFlow team</p>
  `;

  return htmlWrapper("Verify your email address", body);
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function createEmailWorker(
  connection: IORedis,
  emailProvider: EmailProvider,
  dlq: Queue<DlqEntry>,
  logger: {
    info: (obj: Record<string, unknown>, msg: string) => void;
    warn: (obj: Record<string, unknown>, msg: string) => void;
    error: (obj: Record<string, unknown>, msg: string) => void;
  }
): Worker<EmailJobPayload> {
  const frontendUrl =
    process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      logger.info(
        { jobId: job.id, jobType: job.data.type, attempt: job.attemptsMade + 1 },
        "Processing email job"
      );

      const { type, data } = job.data;

      switch (type) {
        case "task_assigned": {
          await emailProvider.send({
            to: data.assigneeEmail,
            subject: `You've been assigned to: ${data.taskTitle}`,
            text: [
              `Hi ${data.assigneeName},`,
              ``,
              `You have been assigned to the following task:`,
              ``,
              `  Task:    ${data.taskTitle}`,
              `  Project: ${data.projectName}`,
              ``,
              `Log in to TaskFlow to view the full details.`,
              ``,
              `— The TaskFlow team`
            ].join("\n"),
            html: taskAssignedHtml({
              assigneeName: data.assigneeName,
              taskTitle: data.taskTitle,
              projectName: data.projectName,
              frontendUrl,
              taskId: data.taskId
            })
          });

          logger.info(
            {
              jobId: job.id,
              taskId: data.taskId,
              assigneeId: data.assigneeId,
              // Omit assigneeEmail from logs to avoid leaking PII
            },
            "Task-assigned email delivered"
          );
          break;
        }

        case "password_reset": {
          await emailProvider.send({
            to: data.email,
            subject: "Reset your TaskFlow password",
            text: [
              `Hi ${data.name},`,
              ``,
              `We received a request to reset your TaskFlow password.`,
              `Click the link below to choose a new one. This link expires in 1 hour`,
              `and can only be used once.`,
              ``,
              `  ${data.resetUrl}`,
              ``,
              `If you didn't request this, you can safely ignore this email —`,
              `your password will not be changed.`,
              ``,
              `— The TaskFlow team`
            ].join("\n"),
            html: passwordResetHtml({
              name: data.name,
              resetUrl: data.resetUrl
            })
          });

          logger.info(
            { jobId: job.id, userId: data.userId },
            // Omit email from logs to avoid leaking PII
            "Password-reset email delivered"
          );
          break;
        }

        case "organization_invitation": {
          await emailProvider.send({
            to: data.email,
            subject: `You've been invited to join ${data.organizationName} on TaskFlow`,
            text: [
              `Hi ${data.name},`,
              ``,
              `You have been invited to join ${data.organizationName} on TaskFlow.`,
              ``,
              `  ${data.inviteUrl}`,
              ``,
              `The invitation expires in 7 days.`,
              ``,
              `— The TaskFlow team`
            ].join("\n"),
            html: organizationInvitationHtml({
              name: data.name,
              organizationName: data.organizationName,
              inviteUrl: data.inviteUrl
            })
          });

          logger.info(
            { jobId: job.id, invitationId: data.invitationId },
            // Omit email from logs to avoid leaking PII
            "Organization-invitation email delivered"
          );
          break;
        }

        case "email_verification": {
          await emailProvider.send({
            to: data.email,
            subject: "Verify your email address",
            // The OTP is intentionally present here — this *is* the delivery
            // channel. It must never appear in a logger.* call below.
            text: [
              `Hi ${data.name},`,
              ``,
              `Use the code below to verify your email address and finish`,
              `setting up your TaskFlow account.`,
              ``,
              `  Verification code: ${data.otp}`,
              ``,
              `This code expires in ${data.expiresInMinutes} minutes and can only be used once.`,
              ``,
              `If you didn't create a TaskFlow account, you can safely ignore this email.`,
              ``,
              `— The TaskFlow team`
            ].join("\n"),
            html: emailVerificationHtml({
              name: data.name,
              otp: data.otp,
              expiresInMinutes: data.expiresInMinutes
            })
          });

          logger.info(
            { jobId: job.id, userId: data.userId },
            // Never log data.otp or data.email — PII / secret.
            "Email-verification email delivered"
          );
          break;
        }

        default: {
          // Guard against unknown job types — log and discard rather than crash.
          logger.warn(
            { jobId: job.id, jobType: type },
            "Unknown email job type — skipping"
          );
        }
      }
    },
    {
      connection,
      concurrency: 5
    }
  );

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, jobType: job.data.type },
      "Email job completed"
    );
  });

  /**
   * "failed" fires on every failed attempt, including intermediate ones that
   * will be retried.  We only forward to the DLQ when all attempts are
   * exhausted (attemptsMade === configured attempts).
   *
   * After forwarding, the original job stays in the main queue's "failed"
   * sorted set (removeOnFail: false) so GET /jobs/:id continues to resolve it.
   */
  worker.on("failed", (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    const exhausted = job.attemptsMade >= maxAttempts;

    if (!exhausted) {
      logger.error(
        {
          jobId: job.id,
          jobType: job.data.type,
          attempt: job.attemptsMade,
          maxAttempts,
          // Log err.message only — avoid leaking stack traces or provider details
          errMsg: err instanceof Error ? err.message : String(err)
        },
        "Email job attempt failed — will retry"
      );
      return;
    }

    // ── All retries exhausted: forward to explicit DLQ ─────────────────────
    logger.error(
      {
        jobId: job.id,
        jobType: job.data.type,
        attemptsMade: job.attemptsMade,
        errMsg: err instanceof Error ? err.message : String(err)
      },
      "Email job exhausted all retries — forwarding to DLQ"
    );

    const dlqEntry: DlqEntry = {
      originalJobId: job.id,
      enqueuedAt: new Date().toISOString(),
      failedReason: err instanceof Error ? err.message : String(err),
      attemptsMade: job.attemptsMade,
      payload: job.data
    };

    // Fire-and-forget: DLQ enqueue failure must not crash the worker event
    // loop.  Log the error and move on.
    dlq.add(`dlq:${job.data.type}`, dlqEntry).catch((dlqErr: unknown) => {
      logger.error(
        {
          originalJobId: job.id,
          dlqErrMsg:
            dlqErr instanceof Error ? dlqErr.message : String(dlqErr)
        },
        "Failed to forward exhausted job to DLQ — manual intervention required"
      );
    });
  });

  return worker;
}
