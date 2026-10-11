import { PrismaClient } from "@prisma/client";

import { createLogger } from "./logger.js";

const logger = createLogger("taskflow-api");

/**
 * Single shared PrismaClient instance for the API process.
 * Each request re-uses this connection pool — never instantiate inside a handler.
 */
export const prisma = new PrismaClient({
  log: [
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" }
  ]
});

prisma.$on("error", (event) => {
  logger.error({ target: event.target, message: event.message }, "Prisma error");
});

prisma.$on("warn", (event) => {
  logger.warn({ target: event.target, message: event.message }, "Prisma warning");
});
