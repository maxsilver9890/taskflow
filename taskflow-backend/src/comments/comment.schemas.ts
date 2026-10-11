import { z } from "zod";

export const createCommentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid()
  }),
  body: z.object({
    content: z.string().trim().min(1).max(5000)
  })
});

export const listCommentsSchema = z.object({
  params: z.object({
    taskId: z.string().uuid()
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

export const commentIdSchema = z.object({
  params: z.object({
    taskId: z.string().uuid(),
    commentId: z.string().uuid()
  })
});

export const updateCommentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid(),
    commentId: z.string().uuid()
  }),
  body: z.object({
    content: z.string().trim().min(1).max(5000)
  })
});
