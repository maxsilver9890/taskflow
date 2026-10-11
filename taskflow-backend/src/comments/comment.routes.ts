import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
  updateCommentHandler
} from "./comment.controller.js";

/**
 * Comments are nested under /tasks/:taskId/comments rather than their own
 * top-level resource — a comment never makes sense outside the task it
 * belongs to, and nesting keeps the org-scoping check (does this task
 * belong to the caller's org?) a single, un-skippable step in the service
 * layer. Mounted alongside the task router at app.use("/tasks", ...), so
 * this router only owns the /:taskId/comments* paths, which never collide
 * with the task router's own routes.
 */
export function createCommentRouter(): Router {
  const router = Router();

  router.use(authenticate, requireVerifiedEmail);

  /**
   * @route   POST /tasks/:taskId/comments
   * @desc    Add a comment to a task.
   * @access  Authenticated
   */
  router.post("/:taskId/comments", createCommentHandler);

  /**
   * @route   GET /tasks/:taskId/comments
   * @desc    List a task's comments, oldest first, paginated.
   * @access  Authenticated
   */
  router.get("/:taskId/comments", listCommentsHandler);

  /**
   * @route   PATCH /tasks/:taskId/comments/:commentId
   * @desc    Edit a comment. Author-only.
   * @access  Authenticated
   */
  router.patch("/:taskId/comments/:commentId", updateCommentHandler);

  /**
   * @route   DELETE /tasks/:taskId/comments/:commentId
   * @desc    Delete a comment. Author or org admin.
   * @access  Authenticated
   */
  router.delete("/:taskId/comments/:commentId", deleteCommentHandler);

  return router;
}
