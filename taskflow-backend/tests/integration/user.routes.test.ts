
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";

function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

function authHeader(token: string) {
  return ["Bearer", token].join(" ");
}

async function verifyUserEmail(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true }
  });
}

async function getVerifiedToken(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
  userId: string
) {
  await verifyUserEmail(userId);

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password });

  if (login.status !== 200) {
    throw new Error(
      `Expected verified login to return 200, received ${login.status}: ${JSON.stringify(login.body)}`
    );
  }

  return login.body.accessToken as string;
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "password_reset_tokens",
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "refresh_tokens",
      "org_members",
      "organizations",
      "users"
    CASCADE;
  `);
}

describe("User profile API", () => {
  const app = createApp(makeRedisStub());

  beforeEach(async () => resetDatabase());
  afterAll(async () => prisma.$disconnect());

  it("returns the authenticated user's profile and organization role", async () => {
    const register = await request(app).post("/auth/register").send({
      email: "profile@example.com",
      name: "Profile User",
      password: "Password123!",
      organizationName: "Profile Org"
    });

    expect(register.status).toBe(201);

    const token = await getVerifiedToken(
      app,
      "profile@example.com",
      "Password123!",
      register.body.user.id
    );

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: register.body.user.id,
      name: "Profile User",
      email: "profile@example.com",
      organization: {
        id: register.body.organization.id,
        name: "Profile Org",
        role: "ORG_ADMIN"
      }
    });
  });

  it("rejects unauthenticated profile requests", async () => {
    const res = await request(app).get("/users/me");
    expect(res.status).toBe(401);
  });

  it("updates the name and rejects protected fields", async () => {
    const register = await request(app).post("/auth/register").send({
      email: "update@example.com",
      name: "Old Name",
      password: "Password123!",
      organizationName: "Update Org"
    });

    expect(register.status).toBe(201);

    const token = await getVerifiedToken(
      app,
      "update@example.com",
      "Password123!",
      register.body.user.id
    );

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", authHeader(token))
      .send({ name: "New Name", id: "spoofed", role: "ORG_ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(res.body.id).toBe(register.body.user.id);
    expect(res.body.organization.name).toBe("Update Org");
  });

  it("changes the password only with the current password", async () => {
    const register = await request(app).post("/auth/register").send({
      email: "password@example.com",
      name: "Password User",
      password: "Password123!",
      organizationName: "Password Org"
    });

    expect(register.status).toBe(201);

    const token = await getVerifiedToken(
      app,
      "password@example.com",
      "Password123!",
      register.body.user.id
    );

    const bad = await request(app)
      .post("/users/me/change-password")
      .set("Authorization", authHeader(token))
      .send({
        currentPassword: "wrong",
        newPassword: "NewPassword123!"
      });

    expect(bad.status).toBe(401);

    const changed = await request(app)
      .post("/users/me/change-password")
      .set("Authorization", authHeader(token))
      .send({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!"
      });

    expect(changed.status).toBe(200);
    expect(changed.body).not.toHaveProperty("passwordHash");

    const login = await request(app).post("/auth/login").send({
      email: "password@example.com",
      password: "NewPassword123!"
    });

    expect(login.status).toBe(200);
  });
});
