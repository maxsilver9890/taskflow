import { z } from "zod";

export const inviteSchema = z.object({ body: z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["ORG_ADMIN", "MEMBER"]).default("MEMBER")
}) });
export const roleSchema = z.object({ body: z.object({ role: z.enum(["ORG_ADMIN", "MEMBER"]) }) });
export const tokenSchema = z.object({ body: z.object({ token: z.string().min(1) }) });
export const createOrganizationSchema = z.object({ body: z.object({
  name: z.string().min(1).max(255).trim()
}) });
export const transferAdminSchema = z.object({ body: z.object({
  userId: z.string().uuid()
}) });
export type InviteBody = z.infer<typeof inviteSchema>["body"];
export type CreateOrganizationBody = z.infer<typeof createOrganizationSchema>["body"];
