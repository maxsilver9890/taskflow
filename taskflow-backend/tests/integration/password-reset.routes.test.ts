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

function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

/**
 * The app wires a real BullMQ Queue backed by the Redis stub above, which
 * can't actually run BullMQ's Lua scripts — the same reason this project's
 * other integration tests never exercise POST /tasks/:id/assign (the other
 * endpoint that enqueues an email job) over HTTP. So here, the HTTP layer is
 * used for everything EXCEPT the enqueue itself: forgotPassword is called
 * directly with this capturing stub standing in for the queue, which still
 * exercises the real service logic and real Prisma writes — only the
 * "send it over BullMQ" step is swapped out. That capture is also the only
 * way to recover the raw (unhashed) reset token a real user would get by
 * email, so the round trip can be driven through the actual HTTP endpoints.
 */
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
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "password_reset_tokens",
      "refresh_tokens",
      "org_members",
      "organizations",
      "users"
    CASCADE;
  `);
}

describe("Password reset integration tests", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(makeRedisStub());
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
      .send({ token: "not-a-real-token", newPassword: "BrandNewPassword123!" });

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

    const register = await request(app).post("/auth/register").send({
      email,
      name: "Reset Flow User",
      password: oldPassword,
      organizationName: "Reset Flow Org"
    });

    expect(register.status).toBe(201);
    const oldRefreshToken: string = register.body.refreshToken;

    const { queue, calls } = makeCapturingQueue();
    await AuthService.forgotPassword(prisma, queue, { email });

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("password_reset");
    expect(calls[0].payload.type).toBe("password_reset");

    const resetUrl =
      calls[0].payload.type === "password_reset" ? calls[0].payload.data.resetUrl : "";
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

    // New password works.
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
      .send({ token: rawToken, newPassword: "AnotherPassword789!" });
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
