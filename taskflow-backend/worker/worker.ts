/**
 * TaskFlow background worker process.
 *
 * Responsibilities:
 *   - Connect to Redis
 *   - Register BullMQ Worker for the email queue
 *   - Process email jobs (task_assigned notifications)
 *   - Retry failed jobs 3 × with exponential back-off (1 s → 2 s → 4 s)
 *   - Move exhausted jobs to the built-in BullMQ "failed" set (DLQ)
 *   - Graceful shutdown on SIGINT / SIGTERM
 *
 * This process is intentionally kept separate from the API server.
 * It imports from src/ but does NOT start an HTTP server.
 */

import { env } from "../src/config/env.js";
import { createLogger } from "../src/config/logger.js";
import {
  connectRedis,
  createRedisConnection,
  registerRedisLogging,
  verifyRedisConnection
} from "../src/config/redis.js";
import { createEmailWorker } from "../src/jobs/email.processor.js";
import { createEmailDlq } from "../src/jobs/queue.js";
import { createEmailProvider } from "../src/lib/email.js";

async function startWorker(): Promise<void> {
  const logger = createLogger("taskflow-worker");

  // BullMQ requires maxRetriesPerRequest=null — already set in createRedisConnection().
  const redisConnection = createRedisConnection();
  registerRedisLogging(redisConnection, logger);

  await connectRedis(redisConnection);
  await verifyRedisConnection(redisConnection);

  logger.info(
    { redisHost: env.redisHost, redisPort: env.redisPort },
    "TaskFlow worker connected to Redis"
  );

  const emailProvider = createEmailProvider();

  // Explicit dead-letter queue — exhausted jobs are forwarded here by the
  // worker's "failed" event handler after all 3 attempts are exhausted.
  const emailDlq = createEmailDlq(redisConnection);

  const emailWorker = createEmailWorker(
    redisConnection,
    emailProvider,
    emailDlq,
    logger
  );

  logger.info(
    { queue: "taskflow:email" },
    "Email worker listening for jobs"
  );

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Worker shutdown signal received");

    try {
      // Close worker first so no new jobs are picked up.
      await emailWorker.close();
      logger.info({}, "Email worker closed");
    } catch (error) {
      logger.error({ err: error }, "Error while closing email worker");
      process.exitCode = 1;
    }

    try {
      if (redisConnection.status !== "end") {
        await redisConnection.quit();
      }
    } catch (error) {
      logger.error({ err: error }, "Error while closing worker Redis connection");
      process.exitCode = 1;
    }

    process.exit(process.exitCode ?? 0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

startWorker().catch((error) => {
  const logger = createLogger("taskflow-worker");
  logger.fatal({ err: error }, "Failed to start TaskFlow worker");
  process.exit(1);
});
