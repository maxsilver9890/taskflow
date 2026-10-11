import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";


import * as AssignmentData from "../../src/tasks/task-assignment.data.js";
import type { EmailJobPayload } from "../../src/jobs/queue.js";
import { assignUser } from "../../src/tasks/task-assignment.service.js";

vi.mock("../../src/tasks/task-assignment.data.js", () => ({
  findTaskForOrganization: vi.fn(),
  findUserMembership: vi.fn(),
  findUserForEmail: vi.fn(),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
}));

// Mock return values below are intentionally partial fixtures (not full Prisma
// rows) — cast through `unknown` to each data-layer function's real return
// type rather than `any`, so a real shape change in task-assignment.data.ts
// still gets caught by the type checker here.
type TaskRecord = Awaited<ReturnType<typeof AssignmentData.findTaskForOrganization>>;
type MembershipRecord = Awaited<ReturnType<typeof AssignmentData.findUserMembership>>;
type AssignmentRecord = Awaited<ReturnType<typeof AssignmentData.createAssignment>>;
type AssigneeRecord = Awaited<ReturnType<typeof AssignmentData.findUserForEmail>>;

describe("task-assignment.service - assignUser", () => {
  const db = {} as unknown as PrismaClient;

  const organizationId =
    "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f";

  const taskId =
    "70000000-0000-4000-8000-000000000001";

  const userId =
    "917ffeaf-f862-4411-82c3-b0f8629d0a0f";

  const task = {
    id: taskId,
    title: "Test task",
    project: {
      id: "c1111111-1111-4111-8111-111111111111",
      name: "Test project",
    },
  };

  const membership = {
    organizationId,
    userId,
    role: "member",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws TASK_NOT_FOUND when the task is outside the organization", async () => {
    vi.mocked(AssignmentData.findTaskForOrganization).mockResolvedValue(null);

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
    });

    expect(AssignmentData.findUserMembership).not.toHaveBeenCalled();
    expect(AssignmentData.createAssignment).not.toHaveBeenCalled();
  });

  it("throws USER_OUTSIDE_ORGANIZATION when the user is not a member", async () => {
    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as unknown as TaskRecord);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(null);

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "USER_OUTSIDE_ORGANIZATION",
    });

    expect(AssignmentData.createAssignment).not.toHaveBeenCalled();
  });

  it("throws TASK_ALREADY_ASSIGNED on duplicate assignment", async () => {
    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as unknown as TaskRecord);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as unknown as MembershipRecord);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "TASK_ALREADY_ASSIGNED",
    });
  });

  it("creates an assignment successfully without a queue", async () => {
    const assignment = {
      taskId,
      userId,
      createdAt: new Date(),
    };

    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as unknown as TaskRecord);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as unknown as MembershipRecord);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockResolvedValue(assignment as unknown as AssignmentRecord);

    const result = await assignUser(
      db,
      organizationId,
      taskId,
      userId,
    );

    expect(result).toEqual(assignment);

    expect(
      AssignmentData.createAssignment,
    ).toHaveBeenCalledWith(db, taskId, userId);
  });

  it("returns the BullMQ jobId when notification enqueue succeeds", async () => {
    const assignment = {
      taskId,
      userId,
      createdAt: new Date(),
    };

    const assignee = {
      id: userId,
      email: "liam.chen@northstar.example",
      name: "Liam Chen",
    };

    const add = vi.fn().mockResolvedValue({
      id: "123",
    });

    const emailQueue = { add } as unknown as Queue<EmailJobPayload>;

    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as unknown as TaskRecord);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as unknown as MembershipRecord);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockResolvedValue(assignment as unknown as AssignmentRecord);

    vi.mocked(
      AssignmentData.findUserForEmail,
    ).mockResolvedValue(assignee as unknown as AssigneeRecord);

    const result = await assignUser(
      db,
      organizationId,
      taskId,
      userId,
      emailQueue,
    );

    expect(result).toEqual({
      ...assignment,
      jobId: "123",
    });

    expect(add).toHaveBeenCalledWith(
      "task_assigned",
      expect.objectContaining({
        type: "task_assigned",
        data: expect.objectContaining({
          assigneeId: userId,
          assigneeEmail: assignee.email,
          assigneeName: assignee.name,
          taskId,
          organizationId,
        }),
      }),
    );
  });
});
