import { Router } from "express";
import type IORedis from "ioredis";

import { verifyRedisConnection } from "../config/redis.js";

export function createHealthRouter(redisConnection: IORedis): Router {
  const router = Router();

  router.get("/health", async (_request, response) => {
    try {
      await verifyRedisConnection(redisConnection);

      response.status(200).json({
        status: "ok"
      });
    } catch {
      response.status(503).json({
        status: "unavailable"
      });
    }
  });

  return router;
}
