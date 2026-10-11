/**
 * Integration tests for /auth/* endpoints.
 *
 * These tests require a live PostgreSQL + Redis instance.
 * Isolation strategy: each test wraps DB operations in a transaction that is
 * rolled back after the test (or uses a dedicated test database configured
 * via TEST_DATABASE_URL env var).
 *
 * Run with: npx vitest run tests/integration/auth.routes.test.ts
 *
 * Required env vars for integration tests:
 *   TEST_DATABASE_URL=postgresql://taskflow:change_me@localhost:5432/taskflow_test
 *   JWT_SECRET=...
 *   JWT_REFRESH_SECRET=...
 *   REDIS_HOST=localhost
 *   REDIS_PORT=6379
 */

import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

// ─── Stub Redis for unit-level route testing ───────────────────────────────────

// Supertest spins up the Express app without actually binding to a port.
// Redis is only needed for BullMQ (Task 04) — for auth-only tests we pass a
// minimal stub that satisfies createApp's parameter type.
function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(makeRedisStub());
  });

  it("returns 422 when body is missing required fields", async () => {
    const res = await request(app).post("/auth/register").send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when email format is invalid", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "not-an-email",
      name: "Test User",
      password: "password123",
      organizationName: "Acme Corp"
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when organizationName is missing", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
      name: "Test User",
      password: "password123"
      // organizationName intentionally omitted
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // Full happy-path test (requires live DB):
  it.todo("returns 201 with accessToken, refreshToken, user, and organization on valid input");
  it.todo("returns 409 EMAIL_IN_USE when the same email is registered twice");
});

describe("POST /auth/login", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(makeRedisStub());
  });

  it("returns 401 for unknown credentials", async () => {
    const res = await request(app).post("/auth/login").send({
      email: "nobody@example.com",
      password: "doesnotmatter"
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 422 when body is missing", async () => {
    const res = await request(app).post("/auth/login").send({});
    expect(res.status).toBe(422);
  });
});

describe("POST /auth/refresh", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(makeRedisStub());
  });

  it("returns 401 when refresh token is invalid JWT", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "not.a.jwt" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_INVALID");
  });
});

describe("Cross-tenant access prevention", () => {
  // These tests verify that a token issued for org A cannot access resources
  // belonging to org B. Full cross-tenant tests live alongside Task 03 routes.
  // Placeholder to document the requirement:
  it.todo("returns 403 when accessing another org's resource with a valid token");
});
