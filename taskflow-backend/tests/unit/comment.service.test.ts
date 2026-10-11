import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import * as CommentData from "../../src/comments/comment.data.js";
import {
  addComment,
  editComment,
  listComments,
  removeComment
} from "../../src/comments/comment.service.js";

vi.mock("../../src/comments/comment.data.js", () => ({
  findTaskInOrg: vi.fn(),
  createComment: vi.fn(),
  findComments: vi.fn(),
  findCommentById: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn()
}));

describe("comment.service", () => {
  const db = {} as unknown as PrismaClient;

  const organizationId = "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f";
  const taskId = "0e8e2e2a-2f4f-4b7a-9f2c-9b8a8e6f6d3a";
  const commentId = "7c6b5a4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";
  const authorId = "917ffeaf-f862-4411-82c3-b0f8629d0a0f";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addComment", () => {
    it("throws TASK_NOT_FOUND when the task isn't in the caller's org", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue(null);

      await expect(
        addComment(db, organizationId, taskId, authorId, "hi")
      ).rejects.toMatchObject({ statusCode: 404, code: "TASK_NOT_FOUND" });

      expect(CommentData.createComment).not.toHaveBeenCalled();
    });

    it("creates the comment once the task is confirmed in-org", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.createComment).mockResolvedValue({
        id: commentId,
        taskId,
        authorId,
        content: "hi"
      } as unknown as Awaited<ReturnType<typeof CommentData.createComment>>);

      const result = await addComment(db, organizationId, taskId, authorId, "hi");

      expect(result).toMatchObject({ id: commentId, content: "hi" });
      expect(CommentData.createComment).toHaveBeenCalledWith(
        db,
        taskId,
        authorId,
        "hi"
      );
    });
  });

  describe("listComments", () => {
    it("throws TASK_NOT_FOUND when the task isn't in the caller's org", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue(null);

      await expect(
        listComments(db, organizationId, taskId, 1, 50)
      ).rejects.toMatchObject({ statusCode: 404, code: "TASK_NOT_FOUND" });
    });

    it("returns a paginated result shape", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findComments).mockResolvedValue({
        data: [{ id: commentId }],
        total: 1
      } as unknown as Awaited<ReturnType<typeof CommentData.findComments>>);

      const result = await listComments(db, organizationId, taskId, 1, 50);

      expect(result).toEqual({
        data: [{ id: commentId }],
        total: 1,
        page: 1,
        limit: 50
      });
      expect(CommentData.findComments).toHaveBeenCalledWith(db, taskId, 0, 50);
    });
  });

  describe("editComment", () => {
    it("throws COMMENT_NOT_FOUND when the comment doesn't exist", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue(null);

      await expect(
        editComment(db, organizationId, taskId, commentId, authorId, "edit")
      ).rejects.toMatchObject({ statusCode: 404, code: "COMMENT_NOT_FOUND" });
    });

    it("throws FORBIDDEN when a non-author tries to edit", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue({
        id: commentId,
        authorId: "someone-else"
      } as unknown as Awaited<ReturnType<typeof CommentData.findCommentById>>);

      await expect(
        editComment(db, organizationId, taskId, commentId, authorId, "edit")
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      expect(CommentData.updateComment).not.toHaveBeenCalled();
    });

    it("updates the comment when the caller is the author", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue({
        id: commentId,
        authorId
      } as unknown as Awaited<ReturnType<typeof CommentData.findCommentById>>);
      vi.mocked(CommentData.updateComment).mockResolvedValue({
        id: commentId,
        content: "edited"
      } as unknown as Awaited<ReturnType<typeof CommentData.updateComment>>);

      const result = await editComment(
        db,
        organizationId,
        taskId,
        commentId,
        authorId,
        "edited"
      );

      expect(result).toMatchObject({ content: "edited" });
    });
  });

  describe("removeComment", () => {
    it("throws FORBIDDEN when a non-author, non-admin tries to delete", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue({
        id: commentId,
        authorId: "someone-else"
      } as unknown as Awaited<ReturnType<typeof CommentData.findCommentById>>);

      await expect(
        removeComment(db, organizationId, taskId, commentId, authorId, "MEMBER")
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      expect(CommentData.deleteComment).not.toHaveBeenCalled();
    });

    it("allows an org admin to delete someone else's comment", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue({
        id: commentId,
        authorId: "someone-else"
      } as unknown as Awaited<ReturnType<typeof CommentData.findCommentById>>);

      await removeComment(
        db,
        organizationId,
        taskId,
        commentId,
        authorId,
        "ORG_ADMIN"
      );

      expect(CommentData.deleteComment).toHaveBeenCalledWith(db, commentId);
    });

    it("allows the author to delete their own comment", async () => {
      vi.mocked(CommentData.findTaskInOrg).mockResolvedValue({ id: taskId });
      vi.mocked(CommentData.findCommentById).mockResolvedValue({
        id: commentId,
        authorId
      } as unknown as Awaited<ReturnType<typeof CommentData.findCommentById>>);

      await removeComment(db, organizationId, taskId, commentId, authorId, "MEMBER");

      expect(CommentData.deleteComment).toHaveBeenCalledWith(db, commentId);
    });
  });
});
