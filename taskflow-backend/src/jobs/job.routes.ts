import { Router } from "express";
import type { Queue } from "bullmq";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import { createJobController } from "./job.controller.js";
import type { DlqEntry, EmailJobPayload } from "./queue.js";

export function createJobRouter(
  queue: Queue<EmailJobPayload>,
  // dlq is accepted here so it can be threaded into the controller/service
  // for future DLQ-inspection endpoints without changing the router signature.
  _dlq: Queue<DlqEntry>
): Router {
  const router = Router();
  const controller = createJobController(queue);

  /**
   * @route   GET /jobs/:id
   * @desc    Return the current status and metadata of a background job.
   * @access  Authenticated
   *
   * Response shape:
   * {
   *   "jobId": "string",
   *   "status": "pending" | "active" | "completed" | "failed",
   *   "type": "task_assigned",
   *   "createdAt": "ISO-8601",
   *   "finishedAt": "ISO-8601 | null",
   *   "attemptsMade": 0,
   *   "failedReason": "string | null"
   * }
   */
  router.get("/:id", authenticate, requireVerifiedEmail, controller.getJob.bind(controller));

  return router;
}
