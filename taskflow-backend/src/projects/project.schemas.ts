import { z } from "zod";

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).optional(),
  }),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(255).optional(),
      description: z.string().trim().max(5000).nullable().optional(),
    })
    .refine(
      (body) => Object.keys(body).length > 0,
      { message: "At least one field must be provided" }
    ),
});

export const projectIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listProjectsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateProjectBody =
  z.infer<typeof createProjectSchema>["body"];

export type UpdateProjectBody =
  z.infer<typeof updateProjectSchema>["body"];

export type ProjectIdParams =
  z.infer<typeof projectIdSchema>["params"];

export type ListProjectsQuery =
  z.infer<typeof listProjectsSchema>["query"];