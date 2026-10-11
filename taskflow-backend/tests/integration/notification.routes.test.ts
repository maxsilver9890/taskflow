import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";

function redisStub() {
  return { status: "ready", ping: async () => "PONG", quit: async () => {} } as
    unknown as import("ioredis").default;
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "notifications", "comments", "task_assignments", "tasks",
      "projects", "refresh_tokens", "org_members", "organizations", "users"
    CASCADE;
  `);
}

describe("Notification API", () => {
  const app = createApp(redisStub());

  beforeEach(() => resetDatabase());
  afterAll(() => prisma.$disconnect());

  it("lists and marks only the authenticated user's notifications", async () => {
    const first = await request(app).post("/auth/register").send({
      email: "notification-one@example.com",
      name: "One",
      password: "Password123!",
      organizationName: "One Org"
    });
    const second = await request(app).post("/auth/register").send({
      email: "notification-two@example.com",
      name: "Two",
      password: "Password123!",
      organizationName: "Two Org"
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: first.body.user.id,
          organizationId: first.body.organization.id,
          title: "First",
          message: "For first"
        },
        {
          userId: second.body.user.id,
          organizationId: second.body.organization.id,
          title: "Second",
          message: "For second"
        }
      ]
    });

    const list = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${first.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe("First");

    const read = await request(app)
      .patch(`/notifications/${list.body.data[0].id}/read`)
      .set("Authorization", `Bearer ${first.body.accessToken}`);
    expect(read.status).toBe(204);

    const afterRead = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${first.body.accessToken}`);
    expect(afterRead.body.unreadCount).toBe(0);
  });
});
