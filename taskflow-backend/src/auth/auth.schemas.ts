import { z } from "zod";

// Zod v4 uses `error` instead of the v3 `required_error` / `invalid_type_error` params.
// The library itself handles "required" messaging when a field is missing and the field
// type is non-optional.

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
    name: z
      .string()
      .min(1, "Name must not be empty")
      .max(255, "Name must be 255 characters or fewer")
      .trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer"),
    /**
     * Name for the new organisation created alongside this account.
     * Registration always creates a fresh org; the registrant becomes its admin.
     */
    organizationName: z
      .string()
      .min(1, "Organization name must not be empty")
      .max(255, "Organization name must be 255 characters or fewer")
      .trim(),
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(1, "Password is required"),
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "refreshToken must not be empty"),
  })
});

export const selectOrganizationSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("organizationId must be a valid UUID")
  })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "refreshToken must not be empty"),
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, "token is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer"),
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "otp must be a 6-digit code"),
  })
});

// Resend has no body — the target user comes from the access token — but we
// still run it through validate() for consistency with every other auth
// route, and so an unexpected body shape is rejected rather than ignored.
export const resendVerificationSchema = z.object({
  body: z.object({}).strict()
});

export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
export type RefreshBody = z.infer<typeof refreshSchema>["body"];
export type SelectOrganizationBody = z.infer<typeof selectOrganizationSchema>["body"];
export type LogoutBody = z.infer<typeof logoutSchema>["body"];
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>["body"];
export type VerifyEmailBody = z.infer<typeof verifyEmailSchema>["body"];
export type ResendVerificationBody = z.infer<typeof resendVerificationSchema>["body"];

export const verifyRegistrationSchema = z.object({
  body: z.object({
    email: z.string().email("Must be a valid email address").toLowerCase().trim(),
    otp: z.string().trim().regex(/^\d{6}$/, "otp must be a 6-digit code")
  })
});

export const resendRegistrationSchema = z.object({
  body: z.object({ email: z.string().email("Must be a valid email address").toLowerCase().trim() })
});

export type VerifyRegistrationBody = z.infer<typeof verifyRegistrationSchema>["body"];
export type ResendRegistrationBody = z.infer<typeof resendRegistrationSchema>["body"];
export const firebaseExchangeSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "Firebase ID token is required"),
    name: z.string().trim().min(1).max(255).optional(),
    organizationName: z.string().trim().min(1).max(255).optional(),
  }),
});

export const firebaseLinkSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "Firebase ID token is required"),
  }),
});

export type FirebaseExchangeBody =
  z.infer<typeof firebaseExchangeSchema>["body"];
export type FirebaseLinkBody = z.infer<typeof firebaseLinkSchema>["body"];
