import { z } from "zod";

const taskStatus = z.enum([
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE"
]);

const taskPriority = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT"
]);

export const createTaskSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(10000).optional(),
    status: taskStatus.default("TODO"),
    priority: taskPriority.default("MEDIUM"),
    dueDate: z.coerce.date().optional()
  })
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    projectId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    status: taskStatus.optional(),
    priority: taskPriority.optional(),
    dueDate: z.coerce.date().nullable().optional()
  }).refine(
    (body) => Object.keys(body).length > 0,
    { message: "At least one field must be provided" }
  )
});

export const taskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const listTasksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),

    status: taskStatus.optional(),
    priority: taskPriority.optional(),
    assignee: z.string().uuid().optional(),

    dueFrom: z.coerce.date().optional(),
    dueTo: z.coerce.date().optional(),

    projectId: z.string().uuid().optional()
  })
});

export const assignTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    userId: z.string().uuid()
  })
});

export const unassignTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid()
  })
});