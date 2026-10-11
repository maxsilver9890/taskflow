import type { NextFunction, Request, Response } from "express";
import type { Queue } from "bullmq";

import { AppError } from "../lib/errors.js";
import { FORBIDDEN_JOB, getJobStatus } from "./job.service.js";
import type { EmailJobPayload } from "./queue.js";

export function createJobController(queue: Queue<EmailJobPayload>) {
  return {
    async getJob(req: Request, res: Response, next: NextFunction) {
      try {
        const id = req.params.id;
        if (typeof id !== "string") {
          throw new AppError(
            400,
            "INVALID_JOB_ID",
            "Invalid job ID"
          );
        }

        // req.auth is guaranteed by the authenticate middleware on this route.
        const orgId = req.auth!.orgId;

        const result = await getJobStatus(queue, id, orgId);

        // Job belongs to a different organization — return 403 without
        // revealing any metadata about the other org's job.
        if (result === FORBIDDEN_JOB) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "You do not have permission to access this resource."
          );
        }

        if (!result) {
          throw new AppError(404, "JOB_NOT_FOUND", "Job not found");
        }

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  };
}
