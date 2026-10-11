import type {
  PrismaClient,
  TaskPriority,
  TaskStatus
} from "@prisma/client";

import { AppError } from "../lib/errors.js";
import * as TaskData from "./task.data.js";

export async function createTask(
  db: PrismaClient,
  organizationId: string,
  data: {
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
  }
) {
  const task = await TaskData.createTask(
    db,
    organizationId,
    data
  );

  if (!task) {
    throw new AppError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found"
    );
  }

  return task;
}

export async function listTasks(
  db: PrismaClient,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string;
    dueFrom?: Date;
    dueTo?: Date;
    projectId?: string;
  }
) {
  const { page, limit, ...taskFilters } = filters;
  const skip = (page - 1) * limit;

  const result = await TaskData.findTasks(
    db,
    organizationId,
    taskFilters,
    skip,
    limit
  );

  return {
    data: result.data,
    total: result.total,
    page,
    limit
  };
}

export async function getTask(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const task = await TaskData.findTaskByIdOnly(db, id);

  if (!task) {
    throw new AppError(
      404,
      "TASK_NOT_FOUND",
      "Task not found"
    );
  }

  if (task.project.organizationId !== organizationId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Forbidden"
    );
  }

  return task;
}

export async function updateTask(
  db: PrismaClient,
  organizationId: string,
  id: string,
  data: {
    projectId?: string;
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: Date | null;
  }
) {
  const task = await TaskData.updateTask(
    db,
    organizationId,
    id,
    data
  );

  if (!task) {
    throw new AppError(
      404,
      "TASK_NOT_FOUND",
      "Task not found or target project is invalid"
    );
  }

  return task;
}

export async function deleteTask(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const task = await TaskData.deleteTask(
    db,
    organizationId,
    id
  );

  if (!task) {
    throw new AppError(
      404,
      "TASK_NOT_FOUND",
      "Task not found"
    );
  }
}