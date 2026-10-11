import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

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

async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
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

describe("Comment API integration tests", () => {
  let app: ReturnType<typeof createApp>;

  let accessToken: string;
  let taskId: string;

  beforeAll(() => {
    app = createApp(makeRedisStub());
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const register = await request(app).post("/auth/register").send({
      email: "comment-test@example.com",
      name: "Comment Test User",
      password: "Password123!",
      organizationName: "Comment Test Organization"
    });

    expect(register.status).toBe(201);

    accessToken = register.body.accessToken;

    const project = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Comment Test Project" });

    expect(project.status).toBe(201);

    const task = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId: project.body.id,
        title: "Task with comments",
        status: "TODO",
        priority: "MEDIUM"
      });

    expect(task.status).toBe(201);

    taskId = task.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("adds a comment and lists it back, oldest first", async () => {
    const first = await request(app)
      .post(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "First comment" });

    expect(first.status).toBe(201);
    expect(first.body).toEqual(
      expect.objectContaining({
        taskId,
        content: "First comment",
        author: expect.objectContaining({ name: "Comment Test User" })
      })
    );

    const second = await request(app)
      .post(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Second comment" });

    expect(second.status).toBe(201);

    const list = await request(app)
      .get(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data.map((c: { content: string }) => c.content)).toEqual([
      "First comment",
      "Second comment"
    ]);
  });

  it("lets the author edit their own comment", async () => {
    const created = await request(app)
      .post(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Original" });

    const edited = await request(app)
      .patch(`/tasks/${taskId}/comments/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Updated" });

    expect(edited.status).toBe(200);
    expect(edited.body.content).toBe("Updated");
  });

  it("lets the author delete their own comment", async () => {
    const created = await request(app)
      .post(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "To be deleted" });

    const deleted = await request(app)
      .delete(`/tasks/${taskId}/comments/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleted.status).toBe(204);

    const list = await request(app)
      .get(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(list.body.total).toBe(0);
  });

  it("blocks a member of another organization from reading or writing comments", async () => {
    const otherOrg = await request(app).post("/auth/register").send({
      email: "other-org@example.com",
      name: "Other Org Admin",
      password: "Password123!",
      organizationName: "Other Org"
    });

    expect(otherOrg.status).toBe(201);

    const readAttempt = await request(app)
      .get(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${otherOrg.body.accessToken}`);

    expect(readAttempt.status).toBe(404);

    const writeAttempt = await request(app)
      .post(`/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${otherOrg.body.accessToken}`)
      .send({ content: "Should not be allowed" });

    expect(writeAttempt.status).toBe(404);
  });

  it("returns 401 without a valid access token", async () => {
    const res = await request(app).get(`/tasks/${taskId}/comments`);

    expect(res.status).toBe(401);
  });
});
