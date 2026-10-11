import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name must not be empty").max(255, "Name must be 255 characters or fewer")
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema
  })
});

export type UpdateMeBody = z.infer<typeof updateMeSchema>["body"];
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>["body"];
