import type { PrismaClient } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import * as CommentData from "./comment.data.js";

async function requireTaskInOrg(
  db: PrismaClient,
  organizationId: string,
  taskId: string
) {
  const task = await CommentData.findTaskInOrg(db, organizationId, taskId);

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }
}

export async function addComment(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  authorId: string,
  content: string
) {
  await requireTaskInOrg(db, organizationId, taskId);

  return CommentData.createComment(db, taskId, authorId, content);
}

export async function listComments(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  page: number,
  limit: number
) {
  await requireTaskInOrg(db, organizationId, taskId);

  const skip = (page - 1) * limit;
  const result = await CommentData.findComments(db, taskId, skip, limit);

  return {
    data: result.data,
    total: result.total,
    page,
    limit
  };
}

export async function editComment(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  commentId: string,
  authorId: string,
  content: string
) {
  await requireTaskInOrg(db, organizationId, taskId);

  const comment = await CommentData.findCommentById(db, taskId, commentId);

  if (!comment) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  if (comment.authorId !== authorId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You can only edit your own comments"
    );
  }

  return CommentData.updateComment(db, commentId, content);
}

export async function removeComment(
  db: PrismaClient,
  organizationId: string,
  taskId: string,
  commentId: string,
  authorId: string,
  role: string
) {
  await requireTaskInOrg(db, organizationId, taskId);

  const comment = await CommentData.findCommentById(db, taskId, commentId);

  if (!comment) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  // Authors can delete their own comments; org admins can moderate any
  // comment on a task within their own organization (already enforced by
  // requireTaskInOrg above).
  if (comment.authorId !== authorId && role !== "ORG_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You can only delete your own comments"
    );
  }

  await CommentData.deleteComment(db, commentId);
}
