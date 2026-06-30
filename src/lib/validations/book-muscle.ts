import { z } from "zod";

/**
 * Validation schema for book muscle create/update operations.
 */
export const muscleSchema = z.object({
  name_he: z
    .string()
    .min(1, "נדרש שם שריר")
    .max(120, "שם ארוך מדי"),
  emoji: z
    .string()
    .max(16, "אמוג'י ארוך מדי")
    .nullable()
    .optional(),
});

export type MuscleInput = z.infer<typeof muscleSchema>;
