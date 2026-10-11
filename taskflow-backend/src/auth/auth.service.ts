import crypto from "node:crypto";

import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import { env } from "../config/env.js";
import { AuthErrors } from "../lib/errors.js";
import type { EmailJobPayload } from "../jobs/queue.js";
import {
  hashToken,
  refreshTokenExpiresAt,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../lib/jwt.js";
import type {
  ForgotPasswordBody,
  LoginBody,
  LogoutBody,
  RefreshBody,
  RegisterBody,
  ResetPasswordBody,
  SelectOrganizationBody,
  VerifyEmailBody,
  VerifyRegistrationBody,
  ResendRegistrationBody
} from "./auth.schemas.js";
import {
  createPasswordResetToken,
  createRefreshToken,
  findPasswordResetTokenByHash,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  findUserEmailVerified,
  invalidateUserPasswordResetTokens,
  markPasswordResetTokenUsed,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  updateUserPassword,
  findOrgMembership,
  createEmailVerificationOtp,
  findActiveEmailVerificationOtp,
  findLatestEmailVerificationOtp,
  invalidateActiveEmailVerificationOtps,
  incrementEmailVerificationOtpAttempts,
  consumeEmailVerificationOtp,
  markUserEmailVerified,
  findPendingRegistrationByEmail,
  upsertPendingRegistration,
  incrementPendingRegistrationAttempts
} from "./auth.data.js";

/** Password reset links are valid for 1 hour. */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Email verification OTPs are valid for 10 minutes. */
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_TTL_MINUTES = OTP_TTL_MS / (60 * 1000);

/** A code locks after this many wrong guesses; the user must request a new one. */
const OTP_MAX_ATTEMPTS = 5;

/** Minimum time between two resend requests for the same user. */
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Best-effort enqueue of a verification-email job, mirroring the
 * "best-effort enqueue after commit" strategy documented in
 * task-assignment.service.ts: the DB write (user/org/OTP row) and the BullMQ
 * enqueue are not — and cannot be — a single distributed transaction, since
 * Redis doesn't participate in Postgres transactions.
 *
 * Failure modes:
 *   1. DB write fails  → no account/no OTP row. Clean state. Caller gets 4xx/5xx.
 *   2. Enqueue fails   → account/OTP row exist, email not sent. Logged at
 *      WARN; NOT rethrown. The request still succeeds (a missing email is a
 *      recoverable UX problem — the user can call POST
 *      /auth/resend-verification once the queue recovers — whereas failing
 *      registration or resend outright over a transient queue blip is not).
 */
async function enqueueVerificationEmail(
  emailQueue: Queue<EmailJobPayload> | undefined,
  user: { id: string; email: string; name: string },
  otp: string
): Promise<void> {
  if (!emailQueue) return;

  try {
    await emailQueue.add("email_verification", {
      type: "email_verification",
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        otp,
        expiresInMinutes: OTP_TTL_MINUTES
      }
    });
  } catch (enqueueError) {
    // Never log user.email or the raw otp — see the PII/secret note on the
    // "email_verification" case in email.processor.ts.
    console.error(
      JSON.stringify({
        level: "warn",
        service: "taskflow-api",
        event: "enqueue_failed",
        jobType: "email_verification",
        userId: user.id,
        err: String(enqueueError)
      })
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Issue a fresh access + refresh token pair and persist the refresh token.
 * Centralised so both /register and /refresh go through identical logic.
 */
async function issueTokenPair(
  db: PrismaClient,
  userId: string,
  orgId: string,
  role: string,
  emailVerified: boolean
) {
  const jti = crypto.randomUUID();
  const rawRefreshToken = signRefreshToken({ sub: userId, jti, orgId });
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = refreshTokenExpiresAt();

  await createRefreshToken(db, { id: jti, userId, tokenHash, expiresAt });

  const accessToken = signAccessToken({ sub: userId, orgId, role, emailVerified });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    tokenType: "Bearer" as const,
    expiresIn: env.jwtAccessTtlSeconds
  };
}

/** Cryptographically secure 6-digit code, zero-padded (crypto.randomInt is CSPRNG-backed). */
function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Constant-time comparison of two equal-length hex digests. */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Invalidate whatever OTP was previously active for this user and persist a
 * fresh one. Returns the raw (unhashed) code for the caller to queue into the
 * verification email — it is never persisted or returned to the API caller.
 */
async function issueNewOtp(db: PrismaClient, userId: string): Promise<string> {
  await invalidateActiveEmailVerificationOtps(db, userId);

  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await createEmailVerificationOtp(db, { userId, otpHash, expiresAt });

  return otp;
}

// ─── Service operations ────────────────────────────────────────────────────────

/**
 * Start a pending registration.
 *
 * New sign-ups store hashed credentials and an OTP on a pending-registration
 * row only. The real user, organisation, and ORG_ADMIN membership are created
 * later by verifyRegistration after a valid OTP. The client never supplies an
 * organizationId or role — both are determined entirely server-side.
 *
 * Existing unverified accounts (created before this pending-row flow) can
 * recover by submitting the same email and password; that path issues a
 * session plus an authenticated OTP without creating a duplicate account.
 *
 * The emailQueue param is optional purely so this function stays unit-testable
 * without a real queue; app.ts always wires a real one in (see
 * forgotPassword for the same pattern).
 */
export async function register(
  db: PrismaClient,
  emailQueue: Queue<EmailJobPayload> | undefined,
  body: RegisterBody
) {
  const existingUser = await findUserByEmail(db, body.email);
  if (existingUser) {
    // Recovery for accounts created by the previous, pre-OTP registration flow.
    // Never create another user/org; only the account's existing password can request a fresh OTP.
    if (existingUser.emailVerified !== false) throw AuthErrors.EMAIL_IN_USE();
    const passwordMatches = await bcrypt.compare(body.password, existingUser.passwordHash);
    if (!passwordMatches) throw AuthErrors.INVALID_CREDENTIALS();
    const membership = await db.orgMember.findFirst({
      where: { userId: existingUser.id }, orderBy: { createdAt: "asc" },
      select: { organizationId: true, role: true, organization: { select: { id: true, name: true } } }
    });
    if (!membership) throw AuthErrors.FORBIDDEN();
    const latest = await findLatestEmailVerificationOtp(db, existingUser.id);
    if (latest) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS) throw AuthErrors.OTP_RESEND_COOLDOWN(Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
    }
    const otp = await issueNewOtp(db, existingUser.id);
    await enqueueVerificationEmail(emailQueue, existingUser, otp);
    const tokens = await issueTokenPair(db, existingUser.id, membership.organizationId, membership.role, false);
    return {
      legacyRecovery: true as const,
      message: "This account already exists but is unverified. A verification code has been requested.",
      email: existingUser.email, expiresInMinutes: OTP_TTL_MINUTES,
      user: { id: existingUser.id, email: existingUser.email, name: existingUser.name, emailVerified: false },
      organization: membership.organization, ...tokens
    };
  }

  const existingPending = await findPendingRegistrationByEmail(db, body.email);
  if (existingPending) {
    const elapsed = Date.now() - existingPending.otpCreatedAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      throw AuthErrors.OTP_RESEND_COOLDOWN(Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
    }
  }

  const rounds = Math.max(env.bcryptRounds, 12);
  const passwordHash = await bcrypt.hash(body.password, rounds);
  const otp = generateOtp();
  const now = new Date();
  await upsertPendingRegistration(db, {
    email: body.email, name: body.name, passwordHash, organizationName: body.organizationName,
    otpHash: hashToken(otp), otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS), otpCreatedAt: now
  });

  try {
    await emailQueue?.add("email_verification", {
      type: "email_verification",
      data: { email: body.email, name: body.name, otp, expiresInMinutes: OTP_TTL_MINUTES }
    });
  } catch (error) {
    // The pending record is recoverable through the resend endpoint. Do not log OTP or email.
    console.error(JSON.stringify({ level: "warn", service: "taskflow-api", event: "enqueue_failed", jobType: "email_verification", err: String(error) }));
  }

  return { message: "If this address can be registered, a verification code has been sent.", email: body.email, expiresInMinutes: OTP_TTL_MINUTES };
}

/** Verify a pending registration, then atomically create the real account and organization. */
export async function verifyRegistration(
  db: PrismaClient,
  body: VerifyRegistrationBody
) {
  const pending = await findPendingRegistrationByEmail(db, body.email);
  if (!pending) throw AuthErrors.OTP_INVALID();
  if (pending.attempts >= OTP_MAX_ATTEMPTS) throw AuthErrors.OTP_LOCKED();
  if (pending.otpExpiresAt < new Date()) throw AuthErrors.OTP_EXPIRED();
  if (!hashesMatch(hashToken(body.otp), pending.otpHash)) {
    await incrementPendingRegistrationAttempts(db, pending.id);
    throw AuthErrors.OTP_INVALID();
  }

  const created = await db.$transaction(async (tx) => {
    const claimed = await tx.pendingRegistration.updateMany({
      where: { id: pending.id, otpHash: pending.otpHash, attempts: { lt: OTP_MAX_ATTEMPTS }, otpExpiresAt: { gt: new Date() } },
      data: { attempts: OTP_MAX_ATTEMPTS }
    });
    if (claimed.count !== 1) throw AuthErrors.OTP_INVALID();
    const org = await tx.organization.create({ data: { name: pending.organizationName }, select: { id: true, name: true } });
    const user = await tx.user.create({
      data: { email: pending.email, name: pending.name, passwordHash: pending.passwordHash, emailVerified: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, name: true, createdAt: true, emailVerified: true }
    });
    await tx.orgMember.create({ data: { userId: user.id, organizationId: org.id, role: "ORG_ADMIN" } });
    await tx.pendingRegistration.delete({ where: { id: pending.id } });
    return { user, org };
  });

  const tokens = await issueTokenPair(db, created.user.id, created.org.id, "ORG_ADMIN", true);
  return { user: created.user, organization: created.org, ...tokens, message: "Email verified successfully." };
}

/** Resend is deliberately generic for unknown emails to avoid account enumeration. */
export async function resendRegistration(
  db: PrismaClient,
  emailQueue: Queue<EmailJobPayload> | undefined,
  body: ResendRegistrationBody
): Promise<{ message: string; cooldownSeconds: number }> {
  const pending = await findPendingRegistrationByEmail(db, body.email);
  if (!pending) return { message: "If a pending registration exists, a new code has been sent.", cooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
  const elapsed = Date.now() - pending.otpCreatedAt.getTime();
  if (elapsed < OTP_RESEND_COOLDOWN_MS) throw AuthErrors.OTP_RESEND_COOLDOWN(Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
  const otp = generateOtp();
  const now = new Date();
  await db.pendingRegistration.update({
    where: { id: pending.id },
    data: { otpHash: hashToken(otp), otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS), otpCreatedAt: now, attempts: 0 }
  });
  try {
    await emailQueue?.add("email_verification", { type: "email_verification", data: { email: pending.email, name: pending.name, otp, expiresInMinutes: OTP_TTL_MINUTES } });
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", service: "taskflow-api", event: "enqueue_failed", jobType: "email_verification", err: String(error) }));
  }
  return { message: "If a pending registration exists, a new code has been sent.", cooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
}

/**
 * Validate credentials and return a token pair for the user's organisation.
 *
 * Multi-org memberships: This implementation selects the first (oldest) org
 * membership to keep the login flow simple. If a user belongs to multiple orgs,
 * a future endpoint (e.g. POST /auth/select-org) should let them switch context.
 */
export async function login(db: PrismaClient, body: LoginBody) {
  // 1. Look up user by email.
  const user = await findUserByEmail(db, body.email);

  /**
   * Always run bcrypt.compare even when user is null to avoid a timing-based
   * user enumeration attack. The dummy hash will always fail comparison.
   */
  const dummyHash = "$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const candidateHash = user?.passwordHash ?? dummyHash;
  const passwordMatch = await bcrypt.compare(body.password, candidateHash);

  if (!user || !passwordMatch) {
    throw AuthErrors.INVALID_CREDENTIALS();
  }

  // 2. Resolve the user's primary organisation membership.
  const membership = await db.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true }
  });

  if (!membership) {
    // User exists but has no org — should not happen given registration logic.
    throw AuthErrors.FORBIDDEN();
  }

  // 3. Verified users receive the normal rotating access/refresh session.
  // Unverified users receive only a short-lived access token in the error
  // details below so they can reach verify/resend; no refresh token is issued.
  if (!user.emailVerified) {
    const verificationToken = signAccessToken({
      sub: user.id,
      orgId: membership.organizationId,
      role: membership.role,
      emailVerified: false
    });

    throw AuthErrors.EMAIL_NOT_VERIFIED({
      accessToken: verificationToken,
      tokenType: "Bearer",
      expiresIn: env.jwtAccessTtlSeconds,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: false }
    });
  }

  const tokens = await issueTokenPair(
    db,
    user.id,
    membership.organizationId,
    membership.role,
    user.emailVerified
  );

  return {
    user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
    ...tokens
  };
}

/**
 * Rotate a refresh token: verify, revoke the old one, issue a fresh pair.
 * Rotation ensures a stolen token can only be used once before it is invalidated.
 */
export async function refresh(db: PrismaClient, body: RefreshBody) {
  // 1. Verify JWT signature + expiry (claims aren't needed — step 6 re-derives
  // membership from the DB record for the new token, same pattern as logout()).
  let refreshPayload;
  try {
    refreshPayload = verifyRefreshToken(body.refreshToken);
  } catch {
    throw AuthErrors.TOKEN_INVALID();
  }

  // 2. Look up stored record by hash.
  const tokenHash = hashToken(body.refreshToken);
  const stored = await findRefreshTokenByHash(db, tokenHash);

  if (!stored) {
    throw AuthErrors.TOKEN_INVALID();
  }

  // 3. Check revocation.
  if (stored.revokedAt !== null) {
    /**
     * A revoked token being replayed could indicate token theft.
     * Revoke all of this user's tokens as a safety measure (TOFU principle).
     */
    await revokeAllUserRefreshTokens(db, stored.userId);
    throw AuthErrors.TOKEN_REVOKED();
  }

  // 4. Check DB-level expiry (belt-and-suspenders alongside JWT exp claim).
  if (stored.expiresAt < new Date()) {
    throw AuthErrors.TOKEN_EXPIRED();
  }

  // 5. Revoke old token before issuing the new pair.
  await revokeRefreshToken(db, stored.id);

  // 6. Resolve membership for new access token claims.
  const membership = refreshPayload.orgId
    ? await findOrgMembership(db, stored.userId, refreshPayload.orgId)
    : await (async () => {
        // Legacy refresh tokens predate organization context. Preserve them
        // only for users with exactly one membership; never guess a context
        // for a multi-organization user.
        const memberships = await db.orgMember.findMany({
          where: { userId: stored.userId },
          select: { organizationId: true, role: true }
        });
        return memberships.length === 1 ? memberships[0] : null;
      })();

  if (!membership) {
    throw AuthErrors.FORBIDDEN();
  }

  // Re-read emailVerified fresh from the DB so a user who verified since
  // their last access token was issued gets the corrected claim immediately,
  // without waiting for their old (unverified) access token to expire.
  const userState = await findUserEmailVerified(db, stored.userId);
  const emailVerified = userState?.emailVerified ?? false;

  const tokens = await issueTokenPair(
    db,
    stored.userId,
    membership.organizationId,
    membership.role,
    emailVerified
  );

  return tokens;
}

/** Switch the active organization after revalidating the user's membership. */
export async function selectOrganization(
  db: PrismaClient,
  userId: string,
  body: SelectOrganizationBody
) {
  const membership = await findOrgMembership(db, userId, body.organizationId);
  if (!membership) throw AuthErrors.FORBIDDEN();

  const userState = await findUserEmailVerified(db, userId);
  const emailVerified = userState?.emailVerified ?? false;

  return {
    ...(await issueTokenPair(db, userId, membership.organizationId, membership.role, emailVerified)),
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role
    }
  };
}

/**
 * Logout: revoke the supplied refresh token.
 * The access token will expire naturally (15 min TTL); no server-side blocklist needed.
 */
export async function logout(db: PrismaClient, body: LogoutBody) {
  // Verify the JWT structure first (avoids DB lookup on garbage input).
  try {
    verifyRefreshToken(body.refreshToken);
  } catch {
    // Already invalid — treat as a successful logout (idempotent).
    return;
  }

  const tokenHash = hashToken(body.refreshToken);
  const stored = await findRefreshTokenByHash(db, tokenHash);

  if (!stored || stored.revokedAt !== null) {
    // Already revoked or unknown — idempotent logout is fine.
    return;
  }

  await revokeRefreshToken(db, stored.id);
}

/**
 * Request a password reset link.
 *
 * Always resolves silently whether or not the email belongs to an account —
 * the controller returns the same generic response either way, so a caller
 * can never use this endpoint to enumerate registered emails. The emailQueue
 * is optional purely so this function stays unit-testable without a real
 * queue; app.ts always wires a real one in.
 */
export async function forgotPassword(
  db: PrismaClient,
  emailQueue: Queue<EmailJobPayload> | undefined,
  body: ForgotPasswordBody
): Promise<void> {
  const user = await findUserByEmail(db, body.email);

  if (!user) {
    return;
  }

  // Only the most recently requested link should ever be redeemable.
  await invalidateUserPasswordResetTokens(db, user.id);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await createPasswordResetToken(db, { userId: user.id, tokenHash, expiresAt });

  await emailQueue?.add("password_reset", {
    type: "password_reset",
    data: {
      userId: user.id,
      email: user.email,
      name: user.name,
      resetUrl: `${env.frontendUrl}/reset-password?token=${rawToken}`
    }
  });
}

/**
 * Redeem a password reset token: verify it, set the new password, consume
 * the token, and revoke every refresh token the user currently holds — a
 * password reset should end every existing session, not just the browser
 * that requested it.
 */
export async function resetPassword(
  db: PrismaClient,
  body: ResetPasswordBody
): Promise<void> {
  const tokenHash = hashToken(body.token);
  const stored = await findPasswordResetTokenByHash(db, tokenHash);

  if (!stored || stored.usedAt !== null || stored.expiresAt < new Date()) {
    throw AuthErrors.TOKEN_INVALID();
  }

  const rounds = Math.max(env.bcryptRounds, 12);
  const passwordHash = await bcrypt.hash(body.newPassword, rounds);

  await updateUserPassword(db, stored.userId, passwordHash);
  await markPasswordResetTokenUsed(db, stored.id);
  await revokeAllUserRefreshTokens(db, stored.userId);
}

/**
 * Redeem the caller's active OTP and mark their email verified.
 *
 * `auth` comes from the authenticated request (req.auth) — there is no
 * email-in-body variant of this endpoint, which sidesteps enumeration
 * entirely: a caller can only ever attempt to verify their own account.
 *
 * On success a fresh token pair is issued with emailVerified: true baked in,
 * so the client can proceed into the app immediately rather than waiting for
 * its current access token to expire.
 */
export async function verifyEmail(
  db: PrismaClient,
  auth: { userId: string; orgId: string; role: string },
  body: VerifyEmailBody
) {
  const user = await findUserById(db, auth.userId);
  if (!user) {
    // Can't happen in practice (the token was just verified) — treat as an
    // invalid session rather than leaking internal state.
    throw AuthErrors.TOKEN_INVALID();
  }

  if (user.emailVerified) {
    throw AuthErrors.EMAIL_ALREADY_VERIFIED();
  }

  const active = await findActiveEmailVerificationOtp(db, auth.userId);

  // No active row (never issued, or already superseded) — same response as
  // a wrong guess so a caller learns nothing about internal OTP state.
  if (!active) {
    throw AuthErrors.OTP_INVALID();
  }

  if (active.attempts >= OTP_MAX_ATTEMPTS) {
    throw AuthErrors.OTP_LOCKED();
  }

  if (active.expiresAt < new Date()) {
    throw AuthErrors.OTP_EXPIRED();
  }

  const providedHash = hashToken(body.otp);

  if (!hashesMatch(providedHash, active.otpHash)) {
    await incrementEmailVerificationOtpAttempts(db, active.id);
    throw AuthErrors.OTP_INVALID();
  }

  // Success: consume the OTP (single-use) and flip the user's verified state.
  await consumeEmailVerificationOtp(db, active.id);
  await markUserEmailVerified(db, auth.userId);

  const tokens = await issueTokenPair(db, auth.userId, auth.orgId, auth.role, true);

  return {
    message: "Email verified successfully.",
    ...tokens
  };
}

/**
 * Generate and queue a new OTP for the caller, enforcing a resend cooldown
 * on top of the route-level IP rate limiter already applied to every /auth/*
 * route (see auth.routes.ts).
 */
export async function resendVerification(
  db: PrismaClient,
  emailQueue: Queue<EmailJobPayload> | undefined,
  auth: { userId: string }
): Promise<{ message: string; cooldownSeconds: number }> {
  const user = await findUserById(db, auth.userId);
  if (!user) {
    throw AuthErrors.TOKEN_INVALID();
  }

  if (user.emailVerified) {
    throw AuthErrors.EMAIL_ALREADY_VERIFIED();
  }

  const latest = await findLatestEmailVerificationOtp(db, auth.userId);

  if (latest) {
    const elapsedMs = Date.now() - latest.createdAt.getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      throw AuthErrors.OTP_RESEND_COOLDOWN(retryAfterSeconds);
    }
  }

  const otp = await issueNewOtp(db, auth.userId);
  await enqueueVerificationEmail(emailQueue, user, otp);

  return {
    message: "Verification code sent.",
    cooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000
  };
}
