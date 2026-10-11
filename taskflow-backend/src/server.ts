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

async function startServer(): Promise<void> {
  const logger = createLogger("taskflow-api");
  const redisConnection = createRedisConnection();
  registerRedisLogging(redisConnection, logger);

  await connectRedis(redisConnection);
  await verifyRedisConnection(redisConnection);

  const app = createApp(redisConnection);
  const server = createServer(app);
  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutdown signal received");

    await new Promise<void>((resolve) => {
      server.close((serverError?: Error) => {
        if (serverError) {
          logger.error({ err: serverError }, "Error while stopping HTTP server");
          process.exitCode = 1;
        }

        resolve();
      });
    });

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

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  server.listen(env.port, "0.0.0.0", () => {
    logger.info({ port: env.port }, "TaskFlow API listening");
  });
}

startServer().catch((error) => {
  const logger = createLogger("taskflow-api");
  logger.fatal({ err: error }, "Failed to start TaskFlow API");
  process.exit(1);
});
