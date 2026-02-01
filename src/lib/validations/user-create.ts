import { z } from "zod";

// Phone validation (Israeli format: 0XX or +972XX)
const phoneRegex = /^0\d{9}$|^\+972\d{9}$/;

// Role options
const userRoles = ["trainee", "trainer", "admin"] as const;

export const userCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),

  phone: z
    .string()
    .regex(phoneRegex, "מספר טלפון לא תקין (פורמט: 0501234567 או +972501234567)"),

  role: z.enum(userRoles, { error: "יש לבחור תפקיד" }),

  email: z
    .string()
    .email("כתובת אימייל לא תקינה")
    .optional()
    .or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof userCreateSchema>;
