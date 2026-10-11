import type { PrismaClient } from "@prisma/client";

export async function findTaskForOrganization(
  db: PrismaClient,
  taskId: string,
  organizationId: string
) {
  return db.task.findFirst({
    where: {
      id: taskId,
      project: {
        organizationId
      }
    },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function findUserForEmail(
  db: PrismaClient,
  userId: string
): Promise<{ id: string; email: string; name: string } | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });
}

export async function findUserMembership(
  db: PrismaClient,
  userId: string,
  organizationId: string
) {
  return db.orgMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId
      }
    }
  });
}

export async function createAssignment(
  db: PrismaClient,
  taskId: string,
  userId: string
) {
  return db.taskAssignment.create({
    data: {
      taskId,
      userId
    }
  });
}

export async function deleteAssignment(
  db: PrismaClient,
  taskId: string,
  userId: string
) {
  return db.taskAssignment.delete({
    where: {
      taskId_userId: {
        taskId,
        userId
      }
    }
  });
}