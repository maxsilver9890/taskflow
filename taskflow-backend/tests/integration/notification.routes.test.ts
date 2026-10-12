
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";
import { createTestEmailCapture } from "../helpers/email-capture.js";
let emailCapture: ReturnType<typeof createTestEmailCapture>;

function redisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => { }
  } as unknown as import("ioredis").default;
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "notifications", "comments", "task_assignments", "tasks",
      "projects", "refresh_tokens","email_verification_otps","password_reset_tokens","pending_registrations", "org_members", "organizations", "users"
    CASCADE;
  `);
}

async function getVerifiedToken(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
  userId: string
): Promise<string> {
  void app; void password; void userId;
  return emailCapture.accessToken(email);
}

describe("Notification API", () => {
  const app = createApp(redisStub());
  emailCapture = createTestEmailCapture();

  beforeEach(() => resetDatabase());

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists and marks only the authenticated user's notifications", async () => {
    const firstEmail = "notification-one@example.com";
    const secondEmail = "notification-two@example.com";
    const password = "Password123!";

    const first = await emailCapture.registerAndVerify(app, {
        email: firstEmail,
        name: "One",
        password,
        organizationName: "One Org"
      });

    expect(first.status).toBe(201);

    const second = await emailCapture.registerAndVerify(app, {
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
          userId: first.body.user.id,
          organizationId: first.body.organization.id,
          title: "First unread",
          message: "Also for first"
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
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.data).toHaveLength(2);
    const foreignNotification = await prisma.notification.findFirstOrThrow({ where: { userId: second.body.user.id } });
    const foreignRead = await request(app)
      .patch(`/notifications/${foreignNotification.id}/read`)
      .set("Authorization", `Bearer ${firstToken}`);
    expect(foreignRead.status).toBe(404);

    const read = await request(app)
      .patch(`/notifications/${list.body.data.find((entry: { title: string }) => entry.title === "First")!.id}/read`)
      .set("Authorization", `Bearer ${firstToken}`);

    expect(read.status).toBe(204);

    const afterRead = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(afterRead.status).toBe(200);
    expect(afterRead.body.unreadCount).toBe(1);

    const allRead = await request(app)
      .post("/notifications/read-all")
      .set("Authorization", `Bearer ${firstToken}`);
    expect(allRead.status).toBe(204);
    const secondUserUnread = await prisma.notification.count({ where: { userId: second.body.user.id, readAt: null } });
    expect(secondUserUnread).toBe(1);
  });
});
