/**
 * Structured application error that carries an HTTP status code and a
 * machine-readable code string so the error handler can emit a consistent
 * JSON response without leaking internal details.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    // Maintains proper prototype chain in transpiled ES5 targets.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const AuthErrors = {
  EMAIL_IN_USE: () =>
    new AppError(409, "EMAIL_IN_USE", "An account with this email already exists."),

  FIREBASE_LINK_CONFLICT: () =>
    new AppError(409, "FIREBASE_LINK_CONFLICT", "This account is already linked to a different Firebase identity."),

  INVALID_CREDENTIALS: () =>
    new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password."),

  TOKEN_MISSING: () =>
    new AppError(401, "TOKEN_MISSING", "Authorization token is required."),

  TOKEN_INVALID: () =>
    new AppError(401, "TOKEN_INVALID", "Authorization token is invalid or expired."),

  TOKEN_REVOKED: () =>
    new AppError(401, "TOKEN_REVOKED", "Refresh token has been revoked."),

  TOKEN_EXPIRED: () =>
    new AppError(401, "TOKEN_EXPIRED", "Refresh token has expired."),

  FORBIDDEN: () =>
    new AppError(403, "FORBIDDEN", "You do not have permission to access this resource."),

  EMAIL_NOT_VERIFIED: (details?: Record<string, unknown>) =>
    new AppError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email address to continue.",
      details
    ),

  EMAIL_ALREADY_VERIFIED: () =>
    new AppError(
      409,
      "EMAIL_ALREADY_VERIFIED",
      "This email address has already been verified."
    ),

  /**
   * Deliberately identical whether the code was wrong, never issued, or
   * already consumed/invalidated — distinguishing those cases in the
   * response would help an attacker narrow down a brute-force search.
   */
  OTP_INVALID: () =>
    new AppError(401, "OTP_INVALID", "That verification code is incorrect."),

  OTP_EXPIRED: () =>
    new AppError(
      401,
      "OTP_EXPIRED",
      "That verification code has expired. Request a new one."
    ),

  OTP_LOCKED: () =>
    new AppError(
      429,
      "OTP_LOCKED",
      "Too many incorrect attempts. Request a new verification code."
    ),

  OTP_RESEND_COOLDOWN: (retryAfterSeconds: number) =>
    new AppError(
      429,
      "OTP_RESEND_COOLDOWN",
      `Please wait ${retryAfterSeconds}s before requesting another code.`,
      { retryAfterSeconds }
    ),
} as const;
