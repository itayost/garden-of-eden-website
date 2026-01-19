import { z } from "zod";
import type { Profile } from "@/types/database";
import type { FieldChange } from "@/types/activity-log";

// Phone validation (Israeli format: 0XX or +972XX)
const phoneRegex = /^0\d{9}$|^\+972\d{9}$/;

export const userEditSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),

  phone: z
    .string()
    .regex(phoneRegex, "מספר טלפון לא תקין (פורמט: 0501234567 או +972501234567)")
    .or(z.literal(""))
    .optional(),

  birthdate: z
    .string()
    .refine(
      (date) => {
        if (!date) return true;
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        const age =
          (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 5 && age <= 100;
      },
      "תאריך לידה לא תקין (גיל 5-100)"
    )
    .or(z.literal(""))
    .optional(),

  role: z.enum(["trainee", "trainer", "admin"]),

  is_active: z.boolean(),
});

export type UserEditFormData = z.infer<typeof userEditSchema>;

// Helper to extract default values from profile
export function getUserEditDefaults(profile: Profile): UserEditFormData {
  return {
    full_name: profile.full_name || "",
    phone: profile.phone || "",
    birthdate: profile.birthdate || "",
    role: profile.role,
    is_active: profile.is_active, // No fallback - DB enforces NOT NULL DEFAULT TRUE
  };
}

// Helper to detect changes for activity log
export function getFieldChanges(
  original: Profile,
  updated: UserEditFormData
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (original.full_name !== updated.full_name) {
    changes.push({
      field: "full_name",
      old_value: original.full_name,
      new_value: updated.full_name,
    });
  }

  // Normalize empty string to null for comparison
  const originalPhone = original.phone || null;
  const updatedPhone = updated.phone || null;
  if (originalPhone !== updatedPhone) {
    changes.push({
      field: "phone",
      old_value: original.phone,
      new_value: updated.phone || null,
    });
  }

  // Normalize empty string to null for comparison
  const originalBirthdate = original.birthdate || null;
  const updatedBirthdate = updated.birthdate || null;
  if (originalBirthdate !== updatedBirthdate) {
    changes.push({
      field: "birthdate",
      old_value: original.birthdate,
      new_value: updated.birthdate || null,
    });
  }

  if (original.role !== updated.role) {
    changes.push({
      field: "role",
      old_value: original.role,
      new_value: updated.role,
    });
  }

  if (original.is_active !== updated.is_active) {
    changes.push({
      field: "is_active",
      old_value: original.is_active,
      new_value: updated.is_active,
    });
  }

  return changes;
}

// Helper to determine the action type based on changes
export function getActionType(changes: FieldChange[]): string {
  const isActiveChange = changes.find((c) => c.field === "is_active");
  if (isActiveChange) {
    return isActiveChange.new_value ? "user_activated" : "user_deactivated";
  }

  const roleChange = changes.find((c) => c.field === "role");
  if (roleChange) {
    return "role_changed";
  }

  return "user_updated";
}
