import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  /**
   * The raw `details` object from the backend's error envelope (e.g.
   * `{ retryAfterSeconds: 42 }` on OTP_RESEND_COOLDOWN), beyond the
   * `issues` shape already unpacked into fieldErrors above.
   */
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string[]> = {},
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isNetwork(): boolean {
    return this.code === "NETWORK_ERROR";
  }
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && "code" in body && "error" in body) {
    const b = body as ApiErrorBody;
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(b.details?.issues ?? {})) {
      if (Array.isArray(value) && value.length > 0) fieldErrors[key] = value;
    }
    return new ApiError(status, b.code, b.error, fieldErrors, b.details ?? {});
  }
  return new ApiError(status, "UNKNOWN_ERROR", `Request failed (${status})`);
}

/** Friendly copy for known backend error codes; falls back to the server message. */
const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don’t match an account.",
  EMAIL_IN_USE: "An account with this email already exists.",
  RATE_LIMIT_EXCEEDED: "Too many sign-in attempts. Wait a minute and try again.",
  TOKEN_INVALID: "Your session has expired. Please sign in again.",
  TOKEN_REVOKED: "Your session was ended. Please sign in again.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  TASK_ALREADY_ASSIGNED: "That person is already assigned to this task.",
  USER_OUTSIDE_ORGANIZATION: "That user isn’t a member of your organization.",
  ASSIGNMENT_NOT_FOUND: "That assignment no longer exists.",
  PROJECT_NOT_FOUND: "This project doesn’t exist or was deleted.",
  TASK_NOT_FOUND: "This task doesn’t exist or was deleted.",
  JOB_NOT_FOUND: "This job is no longer available in the queue.",
  NETWORK_ERROR: "Can’t reach the TaskFlow API. Check your connection or the API URL.",
  FORBIDDEN: "You don’t have permission to do that.",
  EMAIL_NOT_VERIFIED: "Please verify your email address to continue.",
  EMAIL_ALREADY_VERIFIED: "This email address has already been verified.",
  OTP_INVALID: "That code is incorrect. Double-check it and try again.",
  OTP_EXPIRED: "That code has expired. Request a new one.",
  OTP_LOCKED: "Too many incorrect attempts. Request a new code.",
  OTP_RESEND_COOLDOWN: "Please wait a moment before requesting another code.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return FRIENDLY[error.code] ?? error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
