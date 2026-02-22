import { z } from "zod";
import { POSITIONS } from "@/types/player-stats";

// Max file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Profile completion schema
export const profileCompletionSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),
  birthdate: z
    .string()
    .min(1, "נא להזין תאריך לידה")
    .refine(
      (date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 5 && age <= 100;
      },
      "תאריך לידה לא תקין (גיל 5-100)"
    ),
  position: z
    .enum(POSITIONS)
    .optional()
    .nullable(),
  // Photo is handled separately (File object can't be validated by zod directly in all contexts)
});

export type ProfileCompletionData = z.infer<typeof profileCompletionSchema>;

// Onboarding schema (includes name for self-registering users; pre-filled for admin-created)
export const onboardingSchema = z.object({
  full_name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),
  birthdate: z
    .string()
    .min(1, "נא להזין תאריך לידה")
    .refine(
      (date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        const age =
          (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 5 && age <= 100;
      },
      "תאריך לידה לא תקין (גיל 5-100)"
    ),
  position: z.enum(POSITIONS).optional().nullable(),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

// Image validation helper
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "הקובץ גדול מדי. מקסימום 2MB" };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "פורמט לא נתמך. נא להעלות JPEG, PNG או WebP" };
  }
  return { valid: true };
}

// Export constants for use in components
export const IMAGE_CONSTRAINTS = {
  maxSize: MAX_FILE_SIZE,
  maxSizeMB: 2,
  acceptedTypes: ACCEPTED_IMAGE_TYPES,
  acceptString: ACCEPTED_IMAGE_TYPES.join(","),
};
