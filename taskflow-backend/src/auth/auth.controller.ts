import type { NextFunction, Request, Response } from "express";
import type { Queue } from "bullmq";

import { prisma } from "../config/prisma.js";
import type { EmailJobPayload } from "../jobs/queue.js";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyRegistrationSchema,
  resendRegistrationSchema,
  selectOrganizationSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  firebaseExchangeSchema,
  firebaseLinkSchema
} from "./auth.schemas.js";
import * as AuthService from "./auth.service.js";

// Module-level reference set once by setAuthEmailQueue() in app.ts, so
// forgotPasswordHandler can enqueue the reset email without a factory
// pattern refactor — mirrors task.controller.ts's setEmailQueue().
let _emailQueue: Queue<EmailJobPayload> | undefined;

export function setAuthEmailQueue(queue: Queue<EmailJobPayload>): void {
  _emailQueue = queue;
}

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = registerSchema.parse({ body: req.body });
    const result = await AuthService.register(prisma, _emailQueue, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const result = await AuthService.login(prisma, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = refreshSchema.parse({ body: req.body });
    const result = await AuthService.refresh(prisma, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function selectOrganizationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) throw new Error("Authentication context missing");
    const { body } = selectOrganizationSchema.parse({ body: req.body });
    const result = await AuthService.selectOrganization(prisma, req.auth.userId, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = logoutSchema.parse({ body: req.body });
    await AuthService.logout(prisma, body);
    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
}

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = forgotPasswordSchema.parse({ body: req.body });
    await AuthService.forgotPassword(prisma, _emailQueue, body);

    // Identical response whether or not the email is registered — this
    // endpoint must never leak which emails have accounts.
    res.status(200).json({
      message: "If an account exists for that email, a reset link has been sent."
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = resetPasswordSchema.parse({ body: req.body });
    await AuthService.resetPassword(prisma, body);
    res.status(200).json({ message: "Password has been reset. Please log in again." });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) throw new Error("Authentication context missing");
    const { body } = verifyEmailSchema.parse({ body: req.body });
    const result = await AuthService.verifyEmail(prisma, req.auth, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) throw new Error("Authentication context missing");
    resendVerificationSchema.parse({ body: req.body });
    const result = await AuthService.resendVerification(prisma, _emailQueue, req.auth);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}


export async function verifyRegistrationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = verifyRegistrationSchema.parse({ body: req.body });
    const result = await AuthService.verifyRegistration(prisma, body);
    res.status(200).json(result);
  } catch (error) { next(error); }
}

export async function resendRegistrationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = resendRegistrationSchema.parse({ body: req.body });
    const result = await AuthService.resendRegistration(prisma, _emailQueue, body);
    res.status(200).json(result);
  } catch (error) { next(error); }
}

export async function firebaseExchangeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = firebaseExchangeSchema.parse({
      body: req.body
    });

    const result = await AuthService.firebaseExchange(prisma, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function firebaseLinkHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = firebaseLinkSchema.parse({ body: req.body });
    if (!req.auth) throw new Error("Authentication context missing");
    const result = await AuthService.linkFirebaseAccount(prisma, req.auth.userId, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
