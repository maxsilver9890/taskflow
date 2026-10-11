import type { PrismaClient } from "@prisma/client";

// ─── User queries ──────────────────────────────────────────────────────────────

export async function findUserByEmail(db: PrismaClient, email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerified: true
    }
  });
}

export async function findUserById(db: PrismaClient, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true
    }
  });
}

/**
 * Looks up just the emailVerified flag for a user. Used by /auth/refresh and
 * /auth/select-org, which only have a userId (from the refresh token /
 * membership row) and need to re-embed the current verification state into
 * the freshly-issued access token.
 */
export async function findUserEmailVerified(db: PrismaClient, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true }
  });
}

export async function markUserEmailVerified(db: PrismaClient, userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { emailVerified: true, emailVerifiedAt: new Date() }
  });
}

/**
 * Atomically create a user, a new organisation, and the org_admin membership
 * record in a single transaction. The registrant always becomes the org admin —
 * role is never client-supplied.
 *
 * Returns the created user and org so the service can issue tokens immediately.
 */
export async function createUserWithOrg(
  db: PrismaClient,
  data: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName: string;
  }
) {
  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: data.organizationName },
      select: { id: true, name: true }
    });

    const user = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash
      },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    await tx.orgMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "ORG_ADMIN"
      }
    });

    return { user, org };
  });
}

// ─── Organisation membership queries ──────────────────────────────────────────

/**
 * Resolve the caller's membership for a specific organisation.
 * Returns null when the user is not a member — callers treat this as 403.
 */
export async function findOrgMembership(
  db: PrismaClient,
  userId: string,
  organizationId: string
) {
  return db.orgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true } }
    }
  });
}

// ─── Refresh token queries ─────────────────────────────────────────────────────

export async function createRefreshToken(
  db: PrismaClient,
  data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }
) {
  return db.refreshToken.create({ data });
}

/**
 * Lookup a refresh token by its SHA-256 hash.
 * Returns null when the hash is not found (i.e. token was never issued).
 */
export async function findRefreshTokenByHash(db: PrismaClient, tokenHash: string) {
  return db.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true
    }
  });
}

/**
 * Revoke a single refresh token by its DB id.
 * Used by /auth/logout and during token rotation.
 */
export async function revokeRefreshToken(db: PrismaClient, id: string) {
  return db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() }
  });
}

/**
 * Revoke ALL active refresh tokens for a user.
 * Used by the bonus logout-all-devices flow.
 */
export async function revokeAllUserRefreshTokens(db: PrismaClient, userId: string) {
  return db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

// ─── Password reset token queries ──────────────────────────────────────────────

export async function createPasswordResetToken(
  db: PrismaClient,
  data: { userId: string; tokenHash: string; expiresAt: Date }
) {
  return db.passwordResetToken.create({ data });
}

/**
 * Lookup a password reset token by its SHA-256 hash.
 * Returns null when the hash is not found (i.e. token was never issued).
 */
export async function findPasswordResetTokenByHash(db: PrismaClient, tokenHash: string) {
  return db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true
    }
  });
}

export async function markPasswordResetTokenUsed(db: PrismaClient, id: string) {
  return db.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() }
  });
}

/**
 * Invalidate every outstanding (unused) reset token for a user before issuing
 * a new one, so only the most recently requested link is ever redeemable.
 */
export async function invalidateUserPasswordResetTokens(db: PrismaClient, userId: string) {
  return db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }
  });
}

export async function updateUserPassword(db: PrismaClient, userId: string, passwordHash: string) {
  return db.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
}

// ─── Email verification OTP queries ────────────────────────────────────────────

export async function createEmailVerificationOtp(
  db: PrismaClient,
  data: { userId: string; otpHash: string; expiresAt: Date }
) {
  return db.emailVerificationOtp.create({ data });
}

/**
 * The single currently-redeemable OTP for a user, if any: not yet consumed
 * and not superseded by a newer code. Returned even if it has since expired
 * — the service layer distinguishes "wrong code" from "expired code" rather
 * than this query silently filtering expired rows out.
 */
export async function findActiveEmailVerificationOtp(db: PrismaClient, userId: string) {
  return db.emailVerificationOtp.findFirst({
    where: { userId, consumedAt: null, invalidatedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * The most recently generated OTP row for a user regardless of status, used
 * only to enforce the resend cooldown window from its createdAt timestamp.
 */
export async function findLatestEmailVerificationOtp(db: PrismaClient, userId: string) {
  return db.emailVerificationOtp.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * Invalidate every outstanding OTP for a user before issuing a new one, so
 * only the most recently generated code is ever redeemable.
 */
export async function invalidateActiveEmailVerificationOtps(db: PrismaClient, userId: string) {
  return db.emailVerificationOtp.updateMany({
    where: { userId, consumedAt: null, invalidatedAt: null },
    data: { invalidatedAt: new Date() }
  });
}

export async function incrementEmailVerificationOtpAttempts(db: PrismaClient, id: string) {
  return db.emailVerificationOtp.update({
    where: { id },
    data: { attempts: { increment: 1 } }
  });
}

export async function consumeEmailVerificationOtp(db: PrismaClient, id: string) {
  return db.emailVerificationOtp.update({
    where: { id },
    data: { consumedAt: new Date() }
  });
}
