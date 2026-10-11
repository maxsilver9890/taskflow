import type { NextFunction, Request, Response } from "express";
import type { Queue } from "bullmq";

import { prisma } from "../config/prisma.js";
import type { EmailJobPayload } from "../jobs/queue.js";
import {
  assignTaskSchema,
  createTaskSchema,
  listTasksSchema,
  taskIdSchema,
  unassignTaskSchema,
  updateTaskSchema
} from "./task.schemas.js";
import * as TaskService from "./task.service.js";
import * as TaskAssignmentService from "./task-assignment.service.js";

// Module-level reference set once by createTaskHandlers() so individual
// handler exports still work without a factory pattern refactor.
let _emailQueue: Queue<EmailJobPayload> | undefined;

/**
 * Call once at startup (in app.ts) to wire the email queue into the task
 * controller without restructuring the existing handler exports.
 */
export function setEmailQueue(queue: Queue<EmailJobPayload>): void {
  _emailQueue = queue;
}

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new Error("Authentication context missing");
  }

  return req.auth;
}

export async function createTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { body } = createTaskSchema.parse({
      body: req.body
    });

    const auth = requireAuth(req);

    const task = await TaskService.createTask(prisma, auth.orgId, {
      projectId: body.projectId,
      title: body.title,
      status: body.status,
      priority: body.priority,
      ...(body.description !== undefined && {
        description: body.description
      }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate
      })
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function listTasksHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { query } = listTasksSchema.parse({
      query: req.query
    });

    const auth = requireAuth(req);

    const result = await TaskService.listTasks(prisma, auth.orgId, {
      page: query.page,
      limit: query.limit,
      ...(query.status !== undefined && {
        status: query.status
      }),
      ...(query.priority !== undefined && {
        priority: query.priority
      }),
      ...(query.assignee !== undefined && {
        assignee: query.assignee
      }),
      ...(query.dueFrom !== undefined && {
        dueFrom: query.dueFrom
      }),
      ...(query.dueTo !== undefined && {
        dueTo: query.dueTo
      }),
      ...(query.projectId !== undefined && {
        projectId: query.projectId
      })
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = taskIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    const task = await TaskService.getTask(
      prisma,
      auth.orgId,
      params.id
    );

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, body } = updateTaskSchema.parse({
      params: req.params,
      body: req.body
    });

    const auth = requireAuth(req);

    const task = await TaskService.updateTask(
      prisma,
      auth.orgId,
      params.id,
      {
        ...(body.projectId !== undefined && {
          projectId: body.projectId
        }),
        ...(body.title !== undefined && {
          title: body.title
        }),
        ...(body.description !== undefined && {
          description: body.description
        }),
        ...(body.status !== undefined && {
          status: body.status
        }),
        ...(body.priority !== undefined && {
          priority: body.priority
        }),
        ...(body.dueDate !== undefined && {
          dueDate: body.dueDate
        })
      }
    );

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = taskIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    await TaskService.deleteTask(
      prisma,
      auth.orgId,
      params.id
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function assignTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, body } = assignTaskSchema.parse({
      params: req.params,
      body: req.body
    });

    const auth = requireAuth(req);

    const result = await TaskAssignmentService.assignUser(
      prisma,
      auth.orgId,
      params.id,
      body.userId,
      _emailQueue
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function unassignTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = unassignTaskSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    await TaskAssignmentService.unassignUser(
      prisma,
      auth.orgId,
      params.id,
      params.userId
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}