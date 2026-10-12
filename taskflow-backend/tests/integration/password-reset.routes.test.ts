
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import request from "supertest";
import type { Queue } from "bullmq";

import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";
import * as AuthService from "../../src/auth/auth.service.js";
import type { EmailJobPayload } from "../../src/jobs/queue.js";
import { createTestEmailCapture } from "../helpers/email-capture.js";
import { resetTestDatabase as resetSharedTestDatabase } from "../helpers/test-db.js";

function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => { }
  } as unknown as import("ioredis").default;
}

function makeCapturingQueue() {
  const calls: Array<{ name: string; payload: EmailJobPayload }> = [];

  const queue = {
    add: async (name: string, payload: EmailJobPayload) => {
      calls.push({ name, payload });
      return {};
    }
  } as unknown as Queue<EmailJobPayload>;

  return { queue, calls };
}

async function resetTestDatabase() {
  await resetSharedTestDatabase(prisma);
}

describe("Password reset integration tests", () => {
  let app: ReturnType<typeof createApp>;
  let emailCapture: ReturnType<typeof createTestEmailCapture>;

  beforeAll(() => {
    app = createApp(makeRedisStub());
    emailCapture = createTestEmailCapture();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("POST /auth/forgot-password always returns the same generic response, even for an unknown email", async () => {
    const res = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it("POST /auth/forgot-password returns 422 for a malformed email", async () => {
    const res = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(422);
  });

  it("POST /auth/reset-password returns 401 TOKEN_INVALID for a garbage token", async () => {
    const res = await request(app)
      .post("/auth/reset-password")
      .send({
        token: "not-a-real-token",
        newPassword: "BrandNewPassword123!"
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_INVALID");
  });

  it("POST /auth/reset-password returns 422 for a too-short new password", async () => {
    const res = await request(app)
      .post("/auth/reset-password")
      .send({ token: "irrelevant", newPassword: "short" });

    expect(res.status).toBe(422);
  });

  it("completes the full forgot-password -> reset-password -> login round trip", async () => {
    const email = "reset-flow@example.com";
    const oldPassword = "OriginalPassword123!";
    const newPassword = "BrandNewPassword456!";

    const register = await emailCapture.registerAndVerify(app, {
        email,
        name: "Reset Flow User",
        password: oldPassword,
        organizationName: "Reset Flow Org"
      });

    expect(register.status).toBe(201);

    const userId = register.body.user.id as string;

    // Obtain a refresh token for the verified account before resetting.
    const verifiedLogin = await request(app)
      .post("/auth/login")
      .send({ email, password: oldPassword });

    expect(verifiedLogin.status).toBe(200);

    const oldRefreshToken: string = verifiedLogin.body.refreshToken;

    const { queue, calls } = makeCapturingQueue();

    await AuthService.forgotPassword(prisma, queue, { email });

    expect(calls).toHaveLength(1);
    const resetJob = calls[0]!;
    expect(resetJob.name).toBe("password_reset");
    expect(resetJob.payload.type).toBe("password_reset");

    const resetUrl =
      resetJob.payload.type === "password_reset"
        ? resetJob.payload.data.resetUrl
        : "";

    const rawToken = new URL(resetUrl).searchParams.get("token");

    expect(rawToken).toBeTruthy();

    const reset = await request(app)
      .post("/auth/reset-password")
      .send({ token: rawToken, newPassword });

    expect(reset.status).toBe(200);

    // Old password no longer works.
    const oldLogin = await request(app)
      .post("/auth/login")
      .send({ email, password: oldPassword });

    expect(oldLogin.status).toBe(401);

    // New password works for the verified account.
    const newLogin = await request(app)
      .post("/auth/login")
      .send({ email, password: newPassword });

    expect(newLogin.status).toBe(200);

    // Resetting the password revokes every pre-existing refresh token.
    const refreshAttempt = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: oldRefreshToken });

    expect(refreshAttempt.status).toBe(401);

    // The reset token itself is single-use.
    const replay = await request(app)
      .post("/auth/reset-password")
      .send({
        token: rawToken,
        newPassword: "AnotherPassword789!"
      });

    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("TOKEN_INVALID");
  });

  it("does nothing and enqueues no email when requested for an unregistered address", async () => {
    const { queue, calls } = makeCapturingQueue();

    await AuthService.forgotPassword(prisma, queue, {
      email: "ghost@example.com"
    });

    expect(calls).toHaveLength(0);
  });
});
