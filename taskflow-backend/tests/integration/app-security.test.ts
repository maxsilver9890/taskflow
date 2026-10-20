import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

function makeRedisStub(status = "ready") {
  return {
    status,
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

const appOptions = {
  corsOrigins: ["https://taskflow.example"],
  verifyDatabaseConnection: async () => 1
};

describe("application CORS and readiness", () => {
  it("allows configured frontend origins", async () => {
    const app = createApp(makeRedisStub(), appOptions);

    const response = await request(app)
      .get("/health")
      .set("Origin", "https://taskflow.example");

    expect(response.headers["access-control-allow-origin"]).toBe("https://taskflow.example");
    expect(response.headers.vary).toContain("Origin");
  });

  it("does not grant CORS access to unlisted origins", async () => {
    const app = createApp(makeRedisStub(), appOptions);

    const response = await request(app)
      .options("/auth/login")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("reports healthy only when Redis and PostgreSQL checks succeed", async () => {
    const app = createApp(makeRedisStub(), appOptions);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      dependencies: { redis: "ok", database: "ok" }
    });
  });

  it("returns 503 when PostgreSQL is unavailable", async () => {
    const app = createApp(makeRedisStub(), {
      ...appOptions,
      verifyDatabaseConnection: async () => { throw new Error("database down"); }
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "unavailable",
      dependencies: { redis: "ok", database: "unavailable" }
    });
  });

  it("returns 503 when Redis is unavailable", async () => {
    const app = createApp(makeRedisStub("end"), appOptions);

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "unavailable",
      dependencies: { redis: "unavailable", database: "ok" }
    });
  });
});
