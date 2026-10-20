import cors from "cors";
import express from "express";
import helmet from "helmet";
import type IORedis from "ioredis";
import { createDocsRouter } from "./docs/docs.routes.js";

import { setAuthEmailQueue } from "./auth/auth.controller.js";
import { createAuthRouter } from "./auth/auth.routes.js";
import { createCommentRouter } from "./comments/comment.routes.js";
import { createEmailDlq, createEmailQueue } from "./jobs/queue.js";
import { setOrganizationEmailQueue } from "./organizations/organization.controller.js";
import { createJobRouter } from "./jobs/job.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createOrganizationRouter } from "./organizations/organization.routes.js";
import { createProjectRouter } from "./projects/project.routes.js";
import { createHealthRouter } from "./routes/health.js";
import { setEmailQueue } from "./tasks/task.controller.js";
import { createTaskRouter } from "./tasks/task.routes.js";
import { createUserRouter } from "./users/user.routes.js";
import { createNotificationRouter } from "./notifications/notification.routes.js";
import { createActivityRouter } from "./activity/activity.routes.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

export function createApp(
  redisConnection: IORedis,
  options: {
    corsOrigins?: string[];
    verifyDatabaseConnection?: () => Promise<unknown>;
  } = {}
) {
  const app = express();
  const corsOrigins = new Set(options.corsOrigins ?? env.corsOrigins);

  // Trust the first proxy hop so express-rate-limit reads the real client IP
  // when deployed behind nginx / ALB / Cloudflare. Remove in development if
  // running locally without a proxy.
  app.set("trust proxy", 1);
  
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      // Non-browser clients do not send Origin and are not governed by CORS.
      callback(null, origin === undefined || corsOrigins.has(origin));
    }
  }));
  app.use(express.json());

  // ── Background-job queues ─────────────────────────────────────────────────
  const emailQueue = createEmailQueue(redisConnection);
  // Explicit dead-letter queue — the worker forwards exhausted jobs here.
  // The API only reads from it (not currently exposed via REST), but the Queue
  // instance is passed to the job router so job.service.ts can inspect it if
  // needed in future iterations.
  const emailDlq = createEmailDlq(redisConnection);

  // Wire the main queue into the task controller so assignUser can enqueue.
  setEmailQueue(emailQueue);
  // Wire the same queue into the auth controller so forgot-password can enqueue.
  setAuthEmailQueue(emailQueue);
  setOrganizationEmailQueue(emailQueue);

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use(createHealthRouter(
    redisConnection,
    options.verifyDatabaseConnection ?? (() => prisma.$queryRaw`SELECT 1`)
  ));
  app.use("/auth", createAuthRouter());
  app.use("/organizations", createOrganizationRouter());
  app.use("/users", createUserRouter());
  app.use("/notifications", createNotificationRouter());
  app.use("/activity", createActivityRouter());
  app.use("/projects", createProjectRouter());
  app.use("/tasks", createTaskRouter());
  // Comments are nested under /tasks/:taskId/comments — see comment.routes.ts.
  app.use("/tasks", createCommentRouter());
  app.use("/jobs", createJobRouter(emailQueue, emailDlq));
  app.use("/api-docs", createDocsRouter());

  // ── Error handling (must be last) ───────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
