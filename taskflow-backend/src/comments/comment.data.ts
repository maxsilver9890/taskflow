import type { PrismaClient } from "@prisma/client";

const authorSelect = {
  id: true,
  name: true,
  email: true
} as const;

/**
 * Confirms the task exists AND belongs to the caller's organization in one
 * query — the same org-scoping pattern used by task.data.ts. Every comment
 * operation below goes through this first so a caller can never read or
 * write comments on another tenant's task by guessing a taskId.
 */
export async function findTaskInOrg(
  db: PrismaClient,
  organizationId: string,
  taskId: string
) {
  return db.task.findFirst({
    where: {
      id: taskId,
      project: { organizationId }
    },
    select: { id: true }
  });
}

export async function createComment(
  db: PrismaClient,
  taskId: string,
  authorId: string,
  content: string
) {
  return db.comment.create({
    data: { taskId, authorId, content },
    include: { author: { select: authorSelect } }
  });
}

export async function findComments(
  db: PrismaClient,
  taskId: string,
  skip: number,
  take: number
) {
  const [data, total] = await db.$transaction([
    db.comment.findMany({
      where: { taskId },
      include: { author: { select: authorSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take
    }),

    db.comment.count({ where: { taskId } })
  ]);

  return { data, total };
}

export async function findCommentById(
  db: PrismaClient,
  taskId: string,
  commentId: string
) {
  return db.comment.findFirst({
    where: { id: commentId, taskId }
  });
}

export async function updateComment(
  db: PrismaClient,
  commentId: string,
  content: string
) {
  return db.comment.update({
    where: { id: commentId },
    data: { content },
    include: { author: { select: authorSelect } }
  });
}

export async function deleteComment(
  db: PrismaClient,
  commentId: string
) {
  return db.comment.delete({
    where: { id: commentId }
  });
}
