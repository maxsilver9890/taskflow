
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";

function redisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "notifications", "comments", "task_assignments", "tasks",
      "projects", "refresh_tokens", "org_members", "organizations", "users"
    CASCADE;
  `);
}

async function getVerifiedToken(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
  userId: string
): Promise<string> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true }
  });

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

describe("Notification API", () => {
  const app = createApp(redisStub());

  beforeEach(() => resetDatabase());

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists and marks only the authenticated user's notifications", async () => {
    const firstEmail = "notification-one@example.com";
    const secondEmail = "notification-two@example.com";
    const password = "Password123!";

    const first = await request(app)
      .post("/auth/register")
      .send({
        email: firstEmail,
        name: "One",
        password,
        organizationName: "One Org"
      });

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/auth/register")
      .send({
        email: secondEmail,
        name: "Two",
        password,
        organizationName: "Two Org"
      });

    expect(second.status).toBe(201);

    const firstToken = await getVerifiedToken(
      app,
      firstEmail,
      password,
      first.body.user.id
    );

    await getVerifiedToken(
      app,
      secondEmail,
      password,
      second.body.user.id
    );

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
      .set("Authorization", `Bearer ${firstToken}`);

    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe("First");

    const read = await request(app)
      .patch(`/notifications/${list.body.data[0].id}/read`)
      .set("Authorization", `Bearer ${firstToken}`);

    expect(read.status).toBe(204);

    const afterRead = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(afterRead.status).toBe(200);
    expect(afterRead.body.unreadCount).toBe(0);
  });
});
