import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import { AppError } from "../lib/errors.js";
import type { EmailJobPayload } from "../jobs/queue.js";
import * as AssignmentData from "./task-assignment.data.js";

/**
 * Consistency strategy: "best-effort enqueue after commit"
 *
 * The DB write (INSERT into task_assignments) and the BullMQ enqueue are NOT
 * wrapped in a distributed transaction, because Redis does not participate in
 * Postgres transactions.
 *
 * Strategy chosen: persist the assignment first, then enqueue.
 *
 * Rationale:
 *   • A missing email notification is a recoverable UX problem.
 *   • A phantom assignment (enqueued but not committed) would corrupt data.
 *
 * Failure modes:
 *   1. DB write fails  → no assignment, no job.  Clean state.  Client gets 4xx/5xx.
 *   2. Enqueue fails   → assignment exists in DB, email not sent.
 *      Recovery: the error is logged at WARN level. The assignment remains
 *      valid; no rollback is performed.  An operator can re-trigger the job
 *      manually or via a future reconciliation job. The API still returns 201
 *      because the assignment itself succeeded.
 *
 * Alternative considered: transactional outbox pattern (store pending job in
 * a Postgres table inside the same transaction, poll and relay to Redis).
 * Rejected for this implementation scope — adds significant complexity for a
 * mock email sender.  The outbox pattern would be the right choice if email
 * delivery were business-critical.
 */
export async function assignUser(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  userId: string,
  emailQueue?: Queue<EmailJobPayload>
) {
  const task = await AssignmentData.findTaskForOrganization(
    db,
    taskId,
    organizationId
  );

  if (!task) {
    throw new AppError(
      404,
      "TASK_NOT_FOUND",
      "Task not found"
    );
  }

  const membership = await AssignmentData.findUserMembership(
    db,
    userId,
    organizationId
  );

  if (!membership) {
    throw new AppError(
      403,
      "USER_OUTSIDE_ORGANIZATION",
      "User does not belong to this organization"
    );
  }

  // ── 1. Persist the assignment ──────────────────────────────────────────────
  let assignment;
  try {
    assignment = await AssignmentData.createAssignment(db, taskId, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        409,
        "TASK_ALREADY_ASSIGNED",
        "User is already assigned to this task"
      );
    }

    throw error;
  }

  // In-app notification is persisted independently of email delivery. Keep
  // this best-effort so an unavailable notification table cannot undo an
  // already committed assignment during rolling deployments.
  try {
    if ("notification" in db) {
      await db.notification.create({
        data: {
          userId,
          organizationId,
          title: "Task assigned",
          message: `You were assigned to "${task.title}"`,
          link: `/tasks/${task.id}`
        }
      });
    }
  } catch (notificationError) {
    console.error(JSON.stringify({
      level: "warn",
      service: "taskflow-api",
      event: "notification_create_failed",
      taskId,
      userId,
      err: String(notificationError)
    }));
  }

  // ── 2. Enqueue email notification (non-blocking, best-effort) ─────────────
  if (emailQueue) {
    try {
      const assignee = await AssignmentData.findUserForEmail(db, userId);

      if (assignee) {
        const job = await emailQueue.add("task_assigned", {
          type: "task_assigned",
          data: {
            assigneeId: assignee.id,
            assigneeEmail: assignee.email,
            assigneeName: assignee.name,
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.project.id,
            projectName: task.project.name,
            // organizationId is embedded so GET /jobs/:id can enforce
            // cross-tenant isolation without a separate DB lookup.
            organizationId
          }
        });

        // Attach the job ID to the response so the client can poll /jobs/:id.
        return { ...assignment, jobId: job.id };
      }
    } catch (enqueueError) {
      // Log but do not rethrow — the assignment committed successfully.
      // See consistency-strategy comment at the top of this file.
      console.error(
        JSON.stringify({
          level: "warn",
          service: "taskflow-api",
          event: "enqueue_failed",
          taskId,
          userId,
          err: String(enqueueError)
        })
      );
    }
  }

  return assignment;
}

export async function unassignUser(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  userId: string
) {
  const task = await AssignmentData.findTaskForOrganization(
    db,
    taskId,
    organizationId
  );

  if (!task) {
    throw new AppError(
      404,
      "TASK_NOT_FOUND",
      "Task not found"
    );
  }

  try {
    await AssignmentData.deleteAssignment(db, taskId, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(
        404,
        "ASSIGNMENT_NOT_FOUND",
        "Task assignment not found"
      );
    }

    throw error;
  }
}
