import { z } from "zod";

// Password requirements for UI indicators
export const passwordRequirements = [
  {
    label: "לפחות 8 תווים",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "אות גדולה באנגלית",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "אות קטנה באנגלית",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "מספר אחד לפחות",
    test: (value: string) => /\d/.test(value),
  },
] as const;

// Password validation schema with Hebrew error messages
export const passwordSchema = z
  .string()
  .min(8, "הסיסמה חייבת להכיל לפחות 8 תווים")
  .refine((val) => /[A-Z]/.test(val), {
    message: "הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית",
  })
  .refine((val) => /\d/.test(val), {
    message: "הסיסמה חייבת להכיל לפחות מספר אחד",
  });

// Reset password form schema
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
