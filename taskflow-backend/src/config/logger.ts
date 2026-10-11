import pino from "pino";

import { env } from "./env.js";

const rootLogger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  base: {
    env: env.nodeEnv
  }
});

export function createLogger(service: "taskflow-api" | "taskflow-worker") {
  return rootLogger.child({ service });
}
