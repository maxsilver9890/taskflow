import { Router } from "express";

import { authRateLimiter } from "../middleware/rate-limit.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  selectOrganizationHandler,
  registerHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  resendVerificationHandler
} from "./auth.controller.js";

export function createAuthRouter(): Router {
  const router = Router();

  // Apply the rate limiter (10 req/min/IP) to every auth endpoint.
  router.use(authRateLimiter);

  /**
   * @route   POST /auth/register
   * @desc    Create a new user account and organisation; the registrant
   *          becomes ORG_ADMIN of the newly created organisation.
   * @access  Public
   */
  router.post("/register", registerHandler);

  /**
   * @route   POST /auth/login
   * @desc    Validate credentials and receive an access + refresh token pair.
   * @access  Public
   */
  router.post("/login", loginHandler);

  /**
   * @route   POST /auth/refresh
   * @desc    Rotate a refresh token and receive a fresh access + refresh token pair.
   * @access  Public (bearer of a valid refresh token)
   */
  router.post("/refresh", refreshHandler);

  router.post("/select-org", authenticate, selectOrganizationHandler);

  /**
   * @route   POST /auth/logout
   * @desc    Revoke a refresh token. The short-lived access token expires naturally.
   * @access  Public (bearer of a valid refresh token)
   */
  router.post("/logout", logoutHandler);

  /**
   * @route   POST /auth/forgot-password
   * @desc    Request a password reset link. Always responds the same way
   *          whether or not the email is registered, to avoid user
   *          enumeration. In dev/test, the "sent" email is logged to stdout
   *          by the console email provider (see src/lib/email.ts).
   * @access  Public
   */
  router.post("/forgot-password", forgotPasswordHandler);

  /**
   * @route   POST /auth/reset-password
   * @desc    Redeem a reset token (from the emailed link) and set a new
   *          password. Revokes all of the user's existing refresh tokens.
   * @access  Public (bearer of a valid, unexpired, unused reset token)
   */
  router.post("/reset-password", resetPasswordHandler);

  /**
   * @route   POST /auth/verify-email
   * @desc    Redeem the caller's active 6-digit OTP and mark their email
   *          verified. Issues a fresh token pair with emailVerified: true
   *          baked into the access token claims. Deliberately authenticated
   *          (not email-in-body) so a caller can only ever verify their own
   *          account — this is what keeps the endpoint free of email
   *          enumeration.
   * @access  Private (any authenticated user, verified or not)
   */
  router.post("/verify-email", authenticate, verifyEmailHandler);

  /**
   * @route   POST /auth/resend-verification
   * @desc    Generate and queue a new OTP for the caller, invalidating
   *          whatever code was active before it. Subject to a 60s
   *          per-user cooldown on top of the router-level IP rate limiter
   *          above. In dev/test, the "sent" email is logged to stdout by
   *          the console email provider (see src/lib/email.ts).
   * @access  Private (any authenticated user, verified or not)
   */
  router.post("/resend-verification", authenticate, resendVerificationHandler);

  return router;
}
