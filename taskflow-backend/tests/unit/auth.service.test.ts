/**
 * Unit tests for auth service helpers.
 *
 * These tests do NOT require a live database — all Prisma calls are replaced
 * with vi.fn() stubs so the suite runs in isolation.
 *
 * Run with: npx vitest run tests/unit/auth.service.test.ts
 * (Requires vitest to be installed: npm install -D vitest)
 */

import { afterEach, beforeAll, describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import { hashToken, signRefreshToken, verifyAccessToken } from "../../src/lib/jwt.js";
import {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  selectOrganization
} from "../../src/auth/auth.service.js";
import { firebaseAdminAuth } from "../../src/lib/firebase-admin.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the minimal Prisma mock shape needed by auth.service. */
function makePrismaMock() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    orgMember: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    emailVerificationOtp: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    pendingRegistration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as import("@prisma/client").PrismaClient;
}

/** Minimal queue stub that records every job added to it. */
function makeQueueStub() {
  return { add: vi.fn().mockResolvedValue({}) } as unknown as import("bullmq").Queue;
}

// ─── register ─────────────────────────────────────────────────────────────────

describe("auth.service — register", () => {
  let db: ReturnType<typeof makePrismaMock>;
  beforeEach(() => { db = makePrismaMock(); });

  it("rejects an email already owned by an existing account", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1", email: "a@example.com", name: "Alice", passwordHash: "hash", emailVerified: true
    });
    await expect(register(db, undefined, {
      email: "a@example.com", name: "Alice", password: "password123", organizationName: "Acme"
    })).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });

  it("stores a pending registration and queues an OTP without creating a user, organization, membership, or tokens", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.pendingRegistration.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    let saved: { passwordHash: string; otpHash: string } | undefined;
    (db.pendingRegistration.upsert as ReturnType<typeof vi.fn>).mockImplementation(({ create }: { create: unknown }) => { saved = create as { passwordHash: string; otpHash: string }; return Promise.resolve(create); });
    const queue = makeQueueStub();
    const result = await register(db, queue, {
      email: "alice@example.com", name: "Alice", password: "plaintextpassword", organizationName: "Acme"
    });

    expect(result).toMatchObject({ email: "alice@example.com", expiresInMinutes: 10 });
    expect("accessToken" in result).toBe(false);
    expect(saved).toBeDefined();
    expect(saved!.passwordHash).not.toBe("plaintextpassword");
    expect(await bcrypt.compare("plaintextpassword", saved!.passwordHash)).toBe(true);
    expect(saved!.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.refreshToken.create).not.toHaveBeenCalled();
    expect(db.emailVerificationOtp.create).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith("email_verification", expect.objectContaining({
      type: "email_verification", data: expect.objectContaining({ email: "alice@example.com", name: "Alice" })
    }));
    const enqueuedOtp = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0][1].data.otp;
    expect(enqueuedOtp).toMatch(/^\d{6}$/);
  });

  it("creates a pending registration even if the email queue is unavailable", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.pendingRegistration.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.pendingRegistration.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await register(db, undefined, {
      email: "bob@example.com", name: "Bob", password: "plaintextpassword", organizationName: "Acme"
    });
    expect(result.email).toBe("bob@example.com");
    expect(db.pendingRegistration.upsert).toHaveBeenCalledTimes(1);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("does not expose organizationId or role in the request shape", () => {
    // Compile-time guard: RegisterBody must not contain these fields.
    type HasNoOrgId = "organizationId" extends keyof import("../../src/auth/auth.schemas.js").RegisterBody ? true : false;
    type HasNoRole  = "role"           extends keyof import("../../src/auth/auth.schemas.js").RegisterBody ? true : false;
    const _orgId: HasNoOrgId = false;
    const _role:  HasNoRole  = false;
    expect(_orgId).toBe(false);
    expect(_role).toBe(false);
  });
});

describe("auth.service — Firebase account linking", () => {
  const email = "owner@example.com";
  const password = "ExistingPassword123!";
  const uid = "firebase-uid-1";
  let db: ReturnType<typeof makePrismaMock>;
  let account: { id: string; email: string; passwordHash: string; emailVerified: boolean; firebaseUid: string | null };
  let verifyToken: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    account = {
      id: "existing-user",
      email,
      passwordHash: await bcrypt.hash(password, 4),
      emailVerified: true,
      firebaseUid: null
    };
  });

  beforeEach(() => {
    db = makePrismaMock();
    db.user.findUnique = vi.fn().mockImplementation(({ where }: { where: Record<string, string> }) =>
      Promise.resolve(where.id === account.id ? account : null)) as never;
    db.user.updateMany = vi.fn().mockResolvedValue({ count: 1 }) as never;
    verifyToken = vi.spyOn(firebaseAdminAuth, "verifyIdToken").mockResolvedValue({
      uid,
      email: " OWNER@example.com ",
      email_verified: true
    } as Awaited<ReturnType<typeof firebaseAdminAuth.verifyIdToken>>);
  });

  afterEach(() => vi.restoreAllMocks());

  it("links only the authenticated TaskFlow account after verifying the Firebase token", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" })).resolves.toEqual({ linked: true, alreadyLinked: false });
    expect(verifyToken).toHaveBeenCalledWith("fresh-token", true);
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: account.id, firebaseUid: null },
      data: { firebaseUid: uid }
    });
    expect(db.orgMember.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects missing, invalid, or unverified Firebase identities", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    verifyToken.mockRejectedValueOnce(new Error("invalid token"));
    await expect(linkFirebaseAccount(db, account.id, { idToken: "bad-token" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    verifyToken.mockResolvedValueOnce({ uid, email, email_verified: false } as Awaited<ReturnType<typeof firebaseAdminAuth.verifyIdToken>>);
    await expect(linkFirebaseAccount(db, account.id, { idToken: "unverified-token" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not link when the verified Firebase email does not match the TaskFlow account", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    db.user.findUnique = vi.fn().mockResolvedValue({ ...account, email: "different@example.com" }) as never;
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a Firebase UID already owned by another TaskFlow user", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    db.user.findUnique = vi.fn().mockImplementation(({ where }: { where: Record<string, string> }) =>
      Promise.resolve(where.id === account.id ? account : { id: "different-user" })) as never;
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" }))
      .rejects.toMatchObject({ code: "FIREBASE_LINK_CONFLICT" });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("maps a concurrent Firebase UID unique-constraint race to a conflict", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    db.user.updateMany = vi.fn().mockRejectedValue({ code: "P2002" }) as never;
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" }))
      .rejects.toMatchObject({ code: "FIREBASE_LINK_CONFLICT", statusCode: 409 });
  });

  it("makes an already-linked retry idempotent without updating the account", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    db.user.findUnique = vi.fn().mockResolvedValue({ ...account, firebaseUid: uid }) as never;
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" })).resolves.toEqual({ linked: true, alreadyLinked: true });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an account that is already linked to a different Firebase UID", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    db.user.findUnique = vi.fn().mockResolvedValue({ ...account, firebaseUid: "another-uid" }) as never;
    await expect(linkFirebaseAccount(db, account.id, { idToken: "fresh-token" }))
      .rejects.toMatchObject({ code: "FIREBASE_LINK_CONFLICT" });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("allows only one conditional update during concurrent linking attempts", async () => {
    const { linkFirebaseAccount } = await import("../../src/auth/auth.service.js");
    const accountLookupCount = { count: 0 };
    db.user.findUnique = vi.fn().mockImplementation(({ where, select }: { where: Record<string, string>; select?: Record<string, boolean> }) => {
      if (where.id === account.id && select?.firebaseUid && !select.email) return Promise.resolve({ firebaseUid: uid });
      if (where.id === account.id) { accountLookupCount.count++; return Promise.resolve(account); }
      return Promise.resolve(null);
    }) as never;
    db.user.updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }) as never;

    const results = await Promise.all([
      linkFirebaseAccount(db, account.id, { idToken: "fresh-token" }),
      linkFirebaseAccount(db, account.id, { idToken: "fresh-token" })
    ]);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.alreadyLinked).sort()).toEqual([false, true]);
    expect(db.user.updateMany).toHaveBeenCalledTimes(2);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("auth.service — login", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("throws INVALID_CREDENTIALS when the user is not found", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      login(db, { email: "ghost@example.com", password: "password" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("throws INVALID_CREDENTIALS when the password is wrong", async () => {
    const hash = await bcrypt.hash("correctpassword", 4);

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash: hash,
      emailVerified: true
    });

    await expect(
      login(db, { email: "alice@example.com", password: "wrongpassword" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("returns tokens on valid credentials for a verified user", async () => {
    const hash = await bcrypt.hash("correct", 4);
    const userId = "00000000-0000-0000-0000-000000000001";
    const orgId = "00000000-0000-0000-0000-000000000002";

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userId,
      email: "alice@example.com",
      name: "Alice",
      passwordHash: hash,
      emailVerified: true
    });
    (db.orgMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: orgId,
      role: "MEMBER"
    });
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await login(db, { email: "alice@example.com", password: "correct" });

    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(result.tokenType).toBe("Bearer");
    expect(result.user.emailVerified).toBe(true);
    expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: true });
  });

  // it("logs an unverified user in, but embeds emailVerified: false — existing JWT/refresh architecture is unchanged, requireVerifiedEmail is what blocks app access, not login", async () => {
  //   const hash = await bcrypt.hash("correct", 4);
  //   const userId = "00000000-0000-0000-0000-000000000003";
  //   const orgId = "00000000-0000-0000-0000-000000000004";

  //   (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
  //     id: userId,
  //     email: "unverified@example.com",
  //     name: "Unverified",
  //     passwordHash: hash,
  //     emailVerified: false
  //   });
  //   (db.orgMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
  //     organizationId: orgId,
  //     role: "ORG_ADMIN"
  //   });
  //   (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

  //   const result = await login(db, { email: "unverified@example.com", password: "correct" });

  //   // Login itself must NOT be blocked for an unverified user...
  //   expect(result).toHaveProperty("accessToken");
  //   expect(result.user.emailVerified).toBe(false);
  //   // ...but the claim that requireVerifiedEmail reads must correctly say so.
  //   expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: false });
  // });

it("rejects login for an unverified user with a restricted access token and no refresh token", async () => {
  const hash = await bcrypt.hash("correct", 4);
  const userId = "00000000-0000-0000-0000-000000000003";
  const orgId = "00000000-0000-0000-0000-000000000004";

  (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: userId,
    email: "unverified@example.com",
    name: "Unverified",
    passwordHash: hash,
    emailVerified: false
  });

  (db.orgMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    organizationId: orgId,
    role: "ORG_ADMIN"
  });

  await expect(
    login(db, {
      email: "unverified@example.com",
      password: "correct"
    })
  ).rejects.toMatchObject({
    code: "EMAIL_NOT_VERIFIED",
    details: expect.objectContaining({
      accessToken: expect.any(String),
      tokenType: "Bearer",
      user: expect.objectContaining({
        id: userId,
        email: "unverified@example.com",
        emailVerified: false
      })
    })
  });

  expect(db.refreshToken.create).not.toHaveBeenCalled();
});

});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe("auth.service — refresh", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  describe("auth.service — organization selection", () => {
    it("issues tokens for a verified membership", async () => {
      const db = makePrismaMock();
      const userId = "00000000-0000-0000-0000-000000000001";
      const orgId = "00000000-0000-0000-0000-000000000002";
      (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        organizationId: orgId,
        role: "MEMBER",
        organization: { id: orgId, name: "Acme" }
      });
      (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await selectOrganization(db, userId, { organizationId: orgId });
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("re-reads emailVerified from the DB rather than trusting the old session, and does not flip an unverified user to verified", async () => {
      const db = makePrismaMock();
      const userId = "00000000-0000-0000-0000-000000000001";
      const orgId = "00000000-0000-0000-0000-000000000002";
      (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        organizationId: orgId,
        role: "MEMBER",
        organization: { id: orgId, name: "Acme" }
      });
      (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ emailVerified: false });
      (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await selectOrganization(db, userId, { organizationId: orgId });
      expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: false });
    });

    it("carries emailVerified: true through for an already-verified user switching orgs", async () => {
      const db = makePrismaMock();
      const userId = "00000000-0000-0000-0000-000000000001";
      const orgId = "00000000-0000-0000-0000-000000000002";
      (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        organizationId: orgId,
        role: "MEMBER",
        organization: { id: orgId, name: "Acme" }
      });
      (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ emailVerified: true });
      (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await selectOrganization(db, userId, { organizationId: orgId });
      expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: true });
    });

    it("rejects an organization the user does not belong to", async () => {
      const db = makePrismaMock();
      (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(selectOrganization(db, "user-id", {
        organizationId: "00000000-0000-0000-0000-000000000002"
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  it("throws TOKEN_REVOKED and revokes all tokens when replaying a revoked token", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const rawToken = signRefreshToken({ sub: userId, jti: "some-jti" });
    const tokenHash = hashToken(rawToken);

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "some-jti",
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date() // already revoked!
    });
    (db.refreshToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    await expect(
      refresh(db, { refreshToken: rawToken })
    ).rejects.toMatchObject({ code: "TOKEN_REVOKED" });

    expect(db.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tokenHash }) })
    );
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId }) })
    );
  });

  it("throws TOKEN_INVALID when an unrecognised token is supplied", async () => {
    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const rawToken = signRefreshToken({ sub: "user-1", jti: "unknown-jti" });

    await expect(
      refresh(db, { refreshToken: rawToken })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("preserves the selected organization while rotating a refresh token", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const orgId = "00000000-0000-0000-0000-000000000002";
    const rawToken = signRefreshToken({ sub: userId, jti: "selected-jti", orgId });

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "selected-jti",
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null
    });
    (db.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: orgId,
      role: "MEMBER"
    });

    const result = await refresh(db, { refreshToken: rawToken });
    expect(verifyAccessToken(result.accessToken)).toMatchObject({ sub: userId, orgId, role: "MEMBER" });
  });

  it("re-reads emailVerified from the DB on rotation rather than trusting the old token, and does not restore access for a still-unverified user", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const orgId = "00000000-0000-0000-0000-000000000002";
    const rawToken = signRefreshToken({ sub: userId, jti: "unverified-jti", orgId });

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "unverified-jti",
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null
    });
    (db.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: orgId,
      role: "ORG_ADMIN"
    });
    // The user is still unverified — a stale, already-revoked-by-rotation
    // refresh token must never be a backdoor around requireVerifiedEmail.
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ emailVerified: false });

    const result = await refresh(db, { refreshToken: rawToken });
    expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: false });
  });

  it("carries emailVerified: true through rotation once the user has verified", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const orgId = "00000000-0000-0000-0000-000000000002";
    const rawToken = signRefreshToken({ sub: userId, jti: "verified-jti", orgId });

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "verified-jti",
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null
    });
    (db.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: orgId,
      role: "ORG_ADMIN"
    });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ emailVerified: true });

    const result = await refresh(db, { refreshToken: rawToken });
    expect(verifyAccessToken(result.accessToken)).toMatchObject({ emailVerified: true });
  });
});

// ─── Task assignment validation placeholder ────────────────────────────────────

describe("auth.service — logout", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("is idempotent when token is already revoked", async () => {
    const rawToken = signRefreshToken({ sub: "user-1", jti: "jti-1" });

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "jti-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date() // already revoked
    });

    // Should not throw
    await expect(logout(db, { refreshToken: rawToken })).resolves.toBeUndefined();
    expect(db.refreshToken.update).not.toHaveBeenCalled();
  });
});

// ─── forgotPassword ─────────────────────────────────────────────────────────────

describe("auth.service — forgotPassword", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("resolves silently and enqueues nothing when the email is unregistered", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const queue = makeQueueStub();

    await expect(
      forgotPassword(db, queue, { email: "ghost@example.com" })
    ).resolves.toBeUndefined();

    expect(queue.add).not.toHaveBeenCalled();
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("invalidates old tokens, stores a new hashed token, and enqueues the email", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userId,
      email: "alice@example.com",
      name: "Alice",
      passwordHash: "irrelevant"
    });
    (db.passwordResetToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (db.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const queue = makeQueueStub();

    await forgotPassword(db, queue, { email: "alice@example.com" });

    // Any previously outstanding tokens for this user are invalidated first.
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId, usedAt: null }) })
    );

    // A new token is stored — and it's a hash, not the raw value sent to the user.
    expect(db.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const createArg = (db.passwordResetToken.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.userId).toBe(userId);
    expect(typeof createArg.data.tokenHash).toBe("string");
    expect(createArg.data.tokenHash).toHaveLength(64); // sha256 hex

    // The email job carries a reset URL containing the raw (unhashed) token.
    expect(queue.add).toHaveBeenCalledWith(
      "password_reset",
      expect.objectContaining({
        type: "password_reset",
        data: expect.objectContaining({ userId, email: "alice@example.com" })
      })
    );

    const enqueuedPayload = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(enqueuedPayload.data.resetUrl).toContain("/reset-password?token=");
  });

  it("works without a queue (e.g. in environments where it's not wired up)", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash: "irrelevant"
    });
    (db.passwordResetToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (db.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await expect(
      forgotPassword(db, undefined, { email: "alice@example.com" })
    ).resolves.toBeUndefined();
  });
});

// ─── resetPassword ──────────────────────────────────────────────────────────────

describe("auth.service — resetPassword", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("throws TOKEN_INVALID when the token doesn't exist", async () => {
    (db.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      resetPassword(db, { token: "unknown-token", newPassword: "newpassword123" })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("throws TOKEN_INVALID when the token was already used", async () => {
    (db.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: new Date()
    });

    await expect(
      resetPassword(db, { token: "used-token", newPassword: "newpassword123" })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("throws TOKEN_INVALID when the token has expired", async () => {
    (db.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null
    });

    await expect(
      resetPassword(db, { token: "expired-token", newPassword: "newpassword123" })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("hashes the new password, marks the token used, and revokes all refresh tokens", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";

    (db.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "reset-1",
      userId,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null
    });
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.passwordResetToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.refreshToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    await resetPassword(db, { token: "valid-token", newPassword: "brandNewPassword1" });

    const updateArg = (db.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: userId });
    expect(updateArg.data.passwordHash).not.toBe("brandNewPassword1");
    const matches = await bcrypt.compare("brandNewPassword1", updateArg.data.passwordHash);
    expect(matches).toBe(true);

    expect(db.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reset-1" } })
    );
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId }) })
    );
  });
});
