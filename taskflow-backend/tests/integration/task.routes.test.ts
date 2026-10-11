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

describe("Task API integration tests", () => {
  let app: ReturnType<typeof createApp>;

  let accessToken: string;
  let organizationId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(() => {
    app = createApp(makeRedisStub());
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const register = await request(app)
      .post("/auth/register")
      .send({
        email: "task-test@example.com",
        name: "Task Test User",
        password: "Password123!",
        organizationName: "Task Test Organization"
      });

    expect(register.status).toBe(201);

    accessToken = register.body.accessToken;
    organizationId = register.body.organization.id;

    const project = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Task Test Project",
        description: "Integration test project"
      });

    expect(project.status).toBe(201);
    expect(project.body.organizationId).toBe(organizationId);

    projectId = project.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a task", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Create integration task",
        description: "Created by integration test",
        status: "TODO",
        priority: "HIGH"
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        projectId,
        title: "Create integration task",
        status: "TODO",
        priority: "HIGH"
      })
    );

    taskId = res.body.id;
  });

  it("gets a task by id", async () => {
    const create = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Get integration task",
        status: "TODO",
        priority: "MEDIUM"
      });

    expect(create.status).toBe(201);

    taskId = create.body.id;

    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
    expect(res.body.projectId).toBe(projectId);
  });

  it("lists tasks", async () => {
    await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Task One",
        status: "TODO",
        priority: "LOW"
      });

    await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Task Two",
        status: "IN_PROGRESS",
        priority: "HIGH"
      });

    const res = await request(app)
      .get("/tasks?page=1&limit=20")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.data).toHaveLength(2);
  });

  it("updates a task", async () => {
    const create = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Original task title",
        status: "TODO",
        priority: "MEDIUM"
      });

    expect(create.status).toBe(201);

    taskId = create.body.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Updated task title",
        status: "IN_PROGRESS",
        priority: "URGENT"
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated task title");
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.priority).toBe("URGENT");
  });

  it("deletes a task", async () => {
    const create = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId,
        title: "Delete me",
        status: "TODO",
        priority: "LOW"
      });

    expect(create.status).toBe(201);

    taskId = create.body.id;

    const deleteResponse = await request(app)
      .delete(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(404);
    expect(getResponse.body.code).toBe("TASK_NOT_FOUND");
  });

  it("returns 422 for invalid task input", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId: "not-a-uuid",
        title: "",
        status: "NOT_A_STATUS",
        priority: "NOT_A_PRIORITY"
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 when accessing another organization's task", async () => {
    const tenantAProject = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant A Project"
      });

    expect(tenantAProject.status).toBe(201);

    const tenantATask = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        projectId: tenantAProject.body.id,
        title: "Tenant A Private Task",
        status: "TODO",
        priority: "HIGH"
      });

    expect(tenantATask.status).toBe(201);

    const tenantB = await request(app)
      .post("/auth/register")
      .send({
        email: "tenant-b-task@example.com",
        name: "Tenant B User",
        password: "Password123!",
        organizationName: "Tenant B Organization"
      });

    expect(tenantB.status).toBe(201);

    const tenantBToken = tenantB.body.accessToken;

    const forbidden = await request(app)
      .get(`/tasks/${tenantATask.body.id}`)
      .set("Authorization", `Bearer ${tenantBToken}`);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");

    expect(forbidden.body).not.toHaveProperty(
      "id",
      tenantATask.body.id
    );

    expect(forbidden.body).not.toHaveProperty(
      "title",
      "Tenant A Private Task"
    );
  });
});
