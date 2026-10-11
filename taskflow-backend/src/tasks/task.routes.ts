import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import {
  assignTaskHandler,
  createTaskHandler,
  deleteTaskHandler,
  getTaskHandler,
  listTasksHandler,
  unassignTaskHandler,
  updateTaskHandler
} from "./task.controller.js";

export function createTaskRouter(): Router {
  const router = Router();

  // All task routes require authentication.
  router.use(authenticate, requireVerifiedEmail);

  /**
   * @route   POST /tasks
   * @desc    Create a new task inside a project.
   * @access  Authenticated
   */
  router.post("/", createTaskHandler);
  router.post("/:id/assign", assignTaskHandler);
  router.delete("/:id/assign/:userId", unassignTaskHandler);


  /**
   * @route   GET /tasks
   * @desc    List tasks with optional filters (status, priority, assignee, due-date range).
   * @access  Authenticated
   */
  router.get("/", listTasksHandler);

  /**
   * @route   GET /tasks/:id
   * @desc    Get a single task by ID.
   * @access  Authenticated
   */
  router.get("/:id", getTaskHandler);

  /**
   * @route   PATCH /tasks/:id
   * @desc    Update a task.
   * @access  Authenticated
   */
  router.patch("/:id", updateTaskHandler);

  /**
   * @route   DELETE /tasks/:id
   * @desc    Delete a task.
   * @access  Authenticated
   */
  router.delete("/:id", deleteTaskHandler);

  return router;
}
