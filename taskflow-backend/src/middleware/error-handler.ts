import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { createLogger } from "../config/logger.js";
import { AppError } from "../lib/errors.js";

const logger = createLogger("taskflow-api");

export function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({
    error: "Not Found",
    code: "NOT_FOUND",
    details: {}
  });
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
): void {
  // Known application errors — log at warn level, no stack trace needed.
  if (error instanceof AppError) {
    logger.warn(
      { code: error.code, statusCode: error.statusCode, path: request.originalUrl },
      error.message
    );

    response.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details ?? {}
    });
    return;
  }

  // Zod validation errors — 422 with field-level detail.
  if (error instanceof ZodError) {
    logger.warn({ issues: error.issues, path: request.originalUrl }, "Validation error");

    const issues = error.issues.reduce<Record<string, string[]>>((fieldErrors, issue) => {
      const field = issue.path[0] === "body" ? issue.path[1] : issue.path[0];
      if (typeof field !== "string") return fieldErrors;
      (fieldErrors[field] ??= []).push(issue.message);
      return fieldErrors;
    }, {});

    response.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: { issues }
    });
    return;
  }

  // Unexpected errors — log at error with full stack.
  logger.error(
    {
      err: error,
      method: request.method,
      path: request.originalUrl
    },
    "Unhandled application error"
  );

  response.status(500).json({
    error: "Internal Server Error",
    code: "INTERNAL_ERROR",
    details: {}
  });
}
