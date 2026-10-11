
import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import {
  connectRedis,
  createRedisConnection,
  registerRedisLogging,
  verifyRedisConnection
} from "./config/redis.js";
import { createEmailWorker } from "./jobs/email.processor.js";
import { createEmailDlq } from "./jobs/queue.js";
import { createEmailProvider } from "./lib/email.js";

async function startServer(): Promise<void> {
  const logger = createLogger("taskflow-api");
  const redisConnection = createRedisConnection();

  registerRedisLogging(redisConnection, logger);

  let emailWorker: ReturnType<typeof createEmailWorker> | undefined;
  let emailDlq: ReturnType<typeof createEmailDlq> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let isShuttingDown = false;

  try {
    await connectRedis(redisConnection);
    await verifyRedisConnection(redisConnection);

    // Run the email worker alongside the API.
    const emailProvider = createEmailProvider();
    emailDlq = createEmailDlq(redisConnection);

    emailWorker = createEmailWorker(
      redisConnection,
      emailProvider,
      emailDlq,
      logger
    );

    emailWorker.on("ready", () => {
      logger.info({}, "TaskFlow email worker ready");
    });

    emailWorker.on("error", (error: Error) => {
      logger.error({ err: error }, "TaskFlow email worker error");
    });

    const app = createApp(redisConnection);
    server = createServer(app);

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info({ signal }, "Shutdown signal received");

      if (server) {
        await new Promise<void>((resolve) => {
          server!.close((serverError?: Error) => {
            if (serverError) {
              logger.error(
                { err: serverError },
                "Error while stopping HTTP server"
              );
              process.exitCode = 1;
            }

            resolve();
          });
        });
      }

      try {
        if (emailWorker) await emailWorker.close();
      } catch (error) {
        logger.error({ err: error }, "Error while stopping email worker");
        process.exitCode = 1;
      }

      try {
        if (emailDlq) await emailDlq.close();
      } catch (error) {
        logger.error(
          { err: error },
          "Error while closing email dead-letter queue"
        );
        process.exitCode = 1;
      }

      try {
        if (redisConnection.status !== "end") {
          await redisConnection.quit();
        }
      } catch (error) {
        logger.error({ err: error }, "Error while closing Redis connection");
        process.exitCode = 1;
      }

      process.exit(process.exitCode ?? 0);
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

    server.listen(env.port, "0.0.0.0", () => {
      logger.info({ port: env.port }, "TaskFlow API listening");
    });
  } catch (error) {
    logger.fatal(
      { err: error },
      "Failed to start TaskFlow API and email worker"
    );

    try {
      if (emailWorker) await emailWorker.close();
    } catch (closeError) {
      logger.error(
        { err: closeError },
        "Error while cleaning up email worker"
      );
    }

    try {
      if (emailDlq) await emailDlq.close();
    } catch (closeError) {
      logger.error(
        { err: closeError },
        "Error while cleaning up email dead-letter queue"
      );
    }

    try {
      if (redisConnection.status !== "end") {
        await redisConnection.quit();
      }
    } catch (closeError) {
      logger.error(
        { err: closeError },
        "Error while cleaning up Redis connection"
      );
    }

    process.exit(1);
  }
}

void startServer();
