import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { firebaseAdminAuth } from "../../src/lib/firebase-admin.js";
import { signAccessToken } from "../../src/lib/jwt.js";
import { disconnectTestDatabase, resetTestDatabase } from "../helpers/test-db.js";

const redisStub = () => ({ status: "ready", ping: async () => "PONG", quit: async () => {} }) as unknown as import("ioredis").default;

describe("POST /auth/firebase-link", () => {
  const app = createApp(redisStub());
  const email = "link-owner@example.test";
  const password = "ExistingTaskFlowPassword123!";
  const firebaseUid = "verified-firebase-uid";
  const decodedToken = {
    uid: firebaseUid,
    email: ` ${email.toUpperCase()} `,
    email_verified: true
  } as Awaited<ReturnType<typeof firebaseAdminAuth.verifyIdToken>>;
  let accountId: string;
  let taskflowAccessToken: string;
  let verifyToken: ReturnType<typeof vi.spyOn>;

  async function seedAccount(options: { firebaseUid?: string | null; accountEmail?: string } = {}) {
    const organization = await prisma.organization.create({ data: { name: "Existing Workspace" } });
    const user = await prisma.user.create({
      data: {
        email: options.accountEmail ?? email,
        name: "Existing Owner",
        passwordHash: await bcrypt.hash(password, 4),
        emailVerified: true,
        firebaseUid: options.firebaseUid ?? null
      }
    });
    accountId = user.id;
    await prisma.orgMember.create({ data: { userId: user.id, organizationId: organization.id, role: "ORG_ADMIN" } });
    taskflowAccessToken = signAccessToken({ sub: user.id, orgId: organization.id, role: "ORG_ADMIN", emailVerified: true });
    return { user, organization };
  }

  async function link(body: Record<string, unknown> = { idToken: "firebase-id-token" }, token = taskflowAccessToken) {
    const call = request(app).post("/auth/firebase-link");
    if (token) call.set("Authorization", `Bearer ${token}`);
    return call.send(body);
  }

  beforeEach(async () => {
    await resetTestDatabase();
    verifyToken = vi.spyOn(firebaseAdminAuth, "verifyIdToken").mockResolvedValue(decodedToken);
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectTestDatabase();
  });

  it("links the existing user without changing their account data or related records", async () => {
    const { user, organization } = await seedAccount();
    const taskflowLogin = await request(app).post("/auth/login").send({ email, password });
    expect(taskflowLogin.status).toBe(200);
    const project = await prisma.project.create({ data: { organizationId: organization.id, name: "Existing Project" } });
    const task = await prisma.task.create({
      data: { projectId: project.id, title: "Existing Task", status: "TODO", priority: "HIGH" }
    });
    await prisma.taskAssignment.create({ data: { taskId: task.id, userId: user.id } });
    const comment = await prisma.comment.create({ data: { taskId: task.id, authorId: user.id, content: "Existing comment" } });
    const notification = await prisma.notification.create({
      data: { userId: user.id, organizationId: organization.id, title: "Existing notice", message: "Keep me", link: "/tasks" }
    });
    const refreshToken = await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: "existing-refresh-hash", expiresAt: new Date(Date.now() + 60_000) }
    });

    const before = {
      users: await prisma.user.count(),
      organizations: await prisma.organization.count(),
      memberships: await prisma.orgMember.count(),
      projects: await prisma.project.count(),
      tasks: await prisma.task.count(),
      assignments: await prisma.taskAssignment.count(),
      comments: await prisma.comment.count(),
      notifications: await prisma.notification.count(),
      refreshTokens: await prisma.refreshToken.count()
    };

    const response = await link({ idToken: "firebase-id-token" }, taskflowLogin.body.accessToken);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ linked: true, alreadyLinked: false });
    expect(verifyToken).toHaveBeenCalledWith("firebase-id-token", true);
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser).toMatchObject({ id: user.id, email, passwordHash: user.passwordHash, firebaseUid });
    expect(await prisma.orgMember.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: user.id } } })).toBeTruthy();
    expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeTruthy();
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeTruthy();
    expect(await prisma.taskAssignment.findUnique({ where: { taskId_userId: { taskId: task.id, userId: user.id } } })).toBeTruthy();
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeTruthy();
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).toBeTruthy();
    expect(await prisma.refreshToken.findUnique({ where: { id: refreshToken.id } })).toBeTruthy();
    expect({
      users: await prisma.user.count(),
      organizations: await prisma.organization.count(),
      memberships: await prisma.orgMember.count(),
      projects: await prisma.project.count(),
      tasks: await prisma.task.count(),
      assignments: await prisma.taskAssignment.count(),
      comments: await prisma.comment.count(),
      notifications: await prisma.notification.count(),
      refreshTokens: await prisma.refreshToken.count()
    }).toEqual(before);
  });

  it("requires a TaskFlow session obtained with the existing account password", async () => {
    await seedAccount();
    const missingSession = await link({ idToken: "firebase-id-token" }, "");
    expect(missingSession.status).toBe(401);
    expect(missingSession.body.code).toBe("TOKEN_MISSING");

    const wrongPassword = await request(app).post("/auth/login").send({ email, password: "WrongTaskFlowPassword123!" });
    const response = await link({ idToken: "firebase-id-token" }, "");
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe("INVALID_CREDENTIALS");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("TOKEN_MISSING");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: accountId } })).firebaseUid).toBeNull();
  });

  it("validates the Firebase token and requires verified email", async () => {
    await seedAccount();
    expect((await link({})).status).toBe(422);
    verifyToken.mockRejectedValueOnce(new Error("invalid Firebase token"));
    expect((await link()).body.code).toBe("INVALID_CREDENTIALS");
    verifyToken.mockResolvedValueOnce({ ...decodedToken, email_verified: false });
    expect((await link()).body.code).toBe("INVALID_CREDENTIALS");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: accountId } })).firebaseUid).toBeNull();
  });

  it("requires the TaskFlow session itself to represent a verified account", async () => {
    const { user, organization } = await seedAccount();
    const unverifiedSession = signAccessToken({ sub: user.id, orgId: organization.id, role: "ORG_ADMIN", emailVerified: false });
    const response = await link({ idToken: "firebase-id-token" }, unverifiedSession);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).firebaseUid).toBeNull();
  });

  it("rejects a token whose verified email does not match the TaskFlow account", async () => {
    await seedAccount({ accountEmail: "different@example.test" });
    const response = await link();
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: accountId } })).firebaseUid).toBeNull();
  });

  it("rejects a Firebase UID already assigned to another TaskFlow user", async () => {
    await seedAccount();
    await prisma.user.create({
      data: { email: "other@example.test", name: "Other", passwordHash: "unused", emailVerified: true, firebaseUid }
    });
    const response = await link();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("FIREBASE_LINK_CONFLICT");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: accountId } })).firebaseUid).toBeNull();
  });

  it("returns an idempotent result when the same account is already linked", async () => {
    await seedAccount({ firebaseUid });
    const response = await link();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ linked: true, alreadyLinked: true });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });

  it("allows concurrent retries without creating duplicate users or organizations", async () => {
    await seedAccount();
    const [first, second] = await Promise.all([link(), link()]);
    expect([first.status, second.status].every((status) => status === 200)).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: accountId } })).firebaseUid).toBe(firebaseUid);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });
});
