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
  const result = await CommentData.findComments(db, organizationId, taskId, skip, limit);

  return {
    data: result.data.map(({ author, ...comment }) => {
      const { orgMemberships, ...authorDetails } = author;
      return {
        ...comment,
        author: authorDetails,
        authorRole: orgMemberships[0]?.role ?? null,
      };
    }),
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

  if (comment.deletedAt) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  if (comment.authorId !== authorId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You can only edit your own comments"
    );
  }

  const updated = await CommentData.updateComment(db, commentId, content);
  if (!updated) {
    throw new AppError(409, "COMMENT_ALREADY_DELETED", "Comment has already been deleted");
  }
  return updated;
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

  const actorMembership = await db.orgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: authorId } },
    select: { role: true },
  });
  if (!actorMembership || actorMembership.role !== role) {
    throw new AppError(403, "FORBIDDEN", "You are not a member of this organization");
  }

  const comment = await CommentData.findCommentById(db, taskId, commentId);

  if (!comment) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  if (comment.deletedAt) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  // Members may delete their own comments. Organization admins may also
  // moderate comments by members within their organization.
  if (comment.authorId !== authorId) {
    if (actorMembership.role !== "ORG_ADMIN") {
      throw new AppError(403, "FORBIDDEN", "You can only delete your own comments");
    }

    const authorMembership = await db.orgMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: comment.authorId } },
      select: { role: true },
    });
    if (authorMembership?.role !== "MEMBER") {
      throw new AppError(403, "FORBIDDEN", "Admins can only moderate comments by lower-role members");
    }
  }

  const deleter = await db.user.findUnique({
    where: { id: authorId },
    select: { name: true },
  });
  if (!deleter) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const deleted = await CommentData.softDeleteComment(db, commentId, deleter.name);
  if (!deleted.count) {
    throw new AppError(409, "COMMENT_ALREADY_DELETED", "Comment has already been deleted");
  }
}
