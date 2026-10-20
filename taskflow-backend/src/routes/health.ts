import { Router } from "express";
import type IORedis from "ioredis";

import { verifyRedisConnection } from "../config/redis.js";

export function createHealthRouter(
  redisConnection: IORedis,
  verifyDatabaseConnection: () => Promise<unknown>
): Router {
  const router = Router();

  router.get("/health", async (_request, response) => {
    const checks = await Promise.allSettled([
      verifyRedisConnection(redisConnection),
      verifyDatabaseConnection()
    ]);
    const dependencies = {
      redis: checks[0].status === "fulfilled" ? "ok" : "unavailable",
      database: checks[1].status === "fulfilled" ? "ok" : "unavailable"
    };
    const healthy = checks.every((check) => check.status === "fulfilled");

    response.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "unavailable",
      dependencies
    });
  });

  return router;
}
