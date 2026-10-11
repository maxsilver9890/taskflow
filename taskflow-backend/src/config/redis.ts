import IORedis from "ioredis";

import { env } from "./env.js";

export function createRedisConnection(): IORedis {
  return new IORedis({
    host: env.redisHost,
    port: env.redisPort,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true
  });
}

export async function connectRedis(connection: IORedis): Promise<void> {
  if (connection.status === "wait") {
    await connection.connect();
  }
}

export async function verifyRedisConnection(connection: IORedis): Promise<void> {
  if (connection.status !== "ready") {
    throw new Error(`Redis is not ready. Current status: ${connection.status}`);
  }

  const pong = await connection.ping();

  if (pong !== "PONG") {
    throw new Error("Unexpected Redis ping response.");
  }
}

export function registerRedisLogging(
  connection: IORedis,
  logger: {
    info: (object: Record<string, unknown>, message: string) => void;
    error: (object: Record<string, unknown>, message: string) => void;
    warn: (object: Record<string, unknown>, message: string) => void;
  }
): void {
  connection.on("connect", () => {
    logger.info({}, "Redis TCP connection established");
  });

  connection.on("ready", () => {
    logger.info({}, "Redis client ready");
  });

  connection.on("error", (error: Error) => {
    logger.error({ err: error }, "Redis connection error");
  });

  connection.on("close", () => {
    logger.warn({}, "Redis connection closed");
  });
}
