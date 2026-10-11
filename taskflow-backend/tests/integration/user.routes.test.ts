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

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", authHeader(register.body.accessToken));

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

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", authHeader(register.body.accessToken))
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

    const bad = await request(app)
      .post("/users/me/change-password")
      .set("Authorization", authHeader(register.body.accessToken))
      .send({ currentPassword: "wrong", newPassword: "NewPassword123!" });
    expect(bad.status).toBe(401);

    const changed = await request(app)
      .post("/users/me/change-password")
      .set("Authorization", authHeader(register.body.accessToken))
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" });
    expect(changed.status).toBe(200);
    expect(changed.body).not.toHaveProperty("passwordHash");

    const login = await request(app).post("/auth/login").send({
      email: "password@example.com",
      password: "NewPassword123!"
    });
    expect(login.status).toBe(200);
  });
});
