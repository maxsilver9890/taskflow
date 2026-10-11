import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

// ─── Payload shapes ────────────────────────────────────────────────────────────

/**
 * Claims embedded in the short-lived access token.
 * `orgId` is derived server-side — never accepted from client input.
 */
export interface AccessTokenPayload {
  sub: string;      // userId
  orgId: string;    // organisation resolved from DB membership
  role: string;     // OrgMemberRole value
  /**
   * Snapshot of the user's email verification state at the moment this token
   * was issued. Embedding it here lets `authenticate` gate access without an
   * extra DB round-trip per request. It goes stale for at most the access
   * token's TTL (15 min by default); POST /auth/verify-email issues a fresh
   * token pair immediately on success so the client doesn't have to wait
   * that long to proceed.
   */
  emailVerified: boolean;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;       // userId
  jti: string;       // unique token id stored in DB
  /** The selected organization; optional for backwards compatibility. */
  orgId?: string;
  type: "refresh";
}

// ─── Sign ──────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign(
    { ...payload, type: "access" } satisfies AccessTokenPayload,
    env.jwtSecret,
    { expiresIn: env.jwtAccessTtlSeconds }
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  return jwt.sign(
    { ...payload, type: "refresh" } satisfies RefreshTokenPayload,
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshTtlSeconds }
  );
}

// ─── Verify ────────────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;

  // Runtime claim validation — reject tokens that are structurally invalid
  // even if the signature is correct (e.g. tokens signed with wrong shape).
  if (
    typeof payload.sub !== "string" || !payload.sub ||
    typeof payload.orgId !== "string" || !payload.orgId ||
    typeof payload.role !== "string" || !payload.role ||
    typeof payload.emailVerified !== "boolean" ||
    payload.type !== "access"
  ) {
    throw new Error("Invalid access token claims");
  }

  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;

  // Runtime claim validation — reject tokens missing required fields.
  if (
    typeof payload.sub !== "string" || !payload.sub ||
    typeof payload.jti !== "string" || !payload.jti ||
    payload.type !== "refresh"
  ) {
    throw new Error("Invalid refresh token claims");
  }

  return payload;
}

// ─── Token hashing ─────────────────────────────────────────────────────────────

/**
 * One-way SHA-256 hash of a raw refresh token before DB storage.
 * Protects users if the token table is ever compromised.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Compute the exact expiry Date for a refresh token issued right now.
 */
export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + env.jwtRefreshTtlSeconds * 1000);
}
