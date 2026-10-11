import type { NextFunction, Request, Response } from "express";

import { AuthErrors } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

/**
 * The verified identity attached to every authenticated request.
 * `orgId` is resolved server-side from the JWT and must never be
 * overridden by client-supplied values.
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
  /** Snapshot from the access token — see AccessTokenPayload.emailVerified. */
  emailVerified: boolean;
}

// Augment Express's Request so TypeScript knows about `req.auth`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Validates the `Authorization: Bearer <token>` header and attaches the
 * decoded identity to `req.auth`. Downstream handlers can trust that
 * `req.auth` is present and that `orgId` was not supplied by the client.
 *
 * Usage:
 *   router.get('/projects', authenticate, projectController.list);
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(AuthErrors.TOKEN_MISSING());
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      emailVerified: payload.emailVerified
    };

    next();
  } catch {
    next(AuthErrors.TOKEN_INVALID());
  }
}

/**
 * Guards a route to verified-email users only. Must be composed AFTER
 * `authenticate`.
 *
 * Deliberately NOT applied to /auth/* routes themselves — an unverified user
 * must still be able to reach POST /auth/verify-email, POST
 * /auth/resend-verification, POST /auth/logout, etc. It IS applied to every
 * "normal application" resource router (projects, tasks, comments,
 * organizations, users, notifications, jobs) so a freshly-registered account
 * can authenticate but can't use the product until its email is confirmed.
 *
 * Usage:
 *   router.use(authenticate, requireVerifiedEmail);
 */
export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.auth?.emailVerified) {
    next(AuthErrors.EMAIL_NOT_VERIFIED());
    return;
  }

  next();
}

/**
 * Guards a route to org_admin role only.
 * Must be composed AFTER `authenticate`.
 *
 * Usage:
 *   router.delete('/projects/:id', authenticate, requireAdmin, projectController.delete);
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.auth?.role !== "ORG_ADMIN") {
    next(AuthErrors.FORBIDDEN());
    return;
  }

  next();
}

/**
 * Guard that enforces cross-tenant isolation for handlers that receive an
 * `orgId` path or query parameter. The value extracted from the JWT is always
 * used as the authoritative org scope; this helper rejects requests where the
 * client-supplied value doesn't match, preventing probing of other orgs.
 *
 * NOTE: Service-layer queries must ALWAYS scope by `req.auth.orgId`, never by
 * any client-provided org value. This helper is a defence-in-depth addition.
 */
export function assertOrgScope(
  clientOrgId: string,
  req: Request,
  next: NextFunction
): boolean {
  if (clientOrgId !== req.auth?.orgId) {
    next(AuthErrors.FORBIDDEN());
    return false;
  }

  return true;
}
