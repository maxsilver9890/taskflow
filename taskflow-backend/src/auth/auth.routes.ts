
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
  resendVerificationHandler,
  verifyRegistrationHandler,
  resendRegistrationHandler,
  firebaseExchangeHandler
} from "./auth.controller.js";

export function createAuthRouter(): Router {
  const router = Router();

  router.use(authRateLimiter);

  // Legacy registration and email verification.
  router.post("/register", registerHandler);
  router.post("/verify-registration", verifyRegistrationHandler);
  router.post("/resend-registration", resendRegistrationHandler);

  // Legacy login.
  router.post("/login", loginHandler);

  // Firebase login/signup token exchange.
  router.post("/firebase-exchange", firebaseExchangeHandler);

  router.post("/refresh", refreshHandler);
  router.post("/select-org", authenticate, selectOrganizationHandler);
  router.post("/logout", logoutHandler);
  router.post("/forgot-password", forgotPasswordHandler);
  router.post("/reset-password", resetPasswordHandler);
  router.post("/verify-email", authenticate, verifyEmailHandler);
  router.post("/resend-verification", authenticate, resendVerificationHandler);

  return router;
}
