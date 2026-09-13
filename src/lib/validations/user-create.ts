import { z } from "zod";
import { branchIdListSchema } from "@/lib/validations/branch";
import {
  formatPhoneToInternational,
  isValidPhoneIL,
} from "@/lib/validations/common";

const phoneSchema = z
  .string()
  .trim()
  .refine(isValidPhoneIL, "מספר טלפון לא תקין (פורמט: 0501234567)")
  .transform(formatPhoneToInternational);

// Role options
const userRoles = ["trainee", "trainer", "admin"] as const;

export const userCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),

  phone: phoneSchema,

  role: z.enum(userRoles, { message: "יש לבחור תפקיד" }),

  branch_ids: branchIdListSchema,
});

export type CreateUserInput = z.infer<typeof userCreateSchema>;
