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

/**
 * A trainee or trainer with no branch is invisible to the staff of every
 * branch: trainer scope and the branch-scoped lists are both driven by
 * profile_branches. An admin needs none, since an admin sees them all.
 */
export function requireBranchForNonAdmin(
  value: { role: string; branch_ids: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  if (value.role !== "admin" && value.branch_ids.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["branch_ids"],
      message: "יש לבחור סניף אחד לפחות",
    });
  }
}

export const userCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),

  phone: phoneSchema,

  role: z.enum(userRoles, { message: "יש לבחור תפקיד" }),

  branch_ids: branchIdListSchema,
}).superRefine(requireBranchForNonAdmin);

export type CreateUserInput = z.infer<typeof userCreateSchema>;
