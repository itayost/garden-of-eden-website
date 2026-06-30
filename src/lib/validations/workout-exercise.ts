import { z } from "zod";

/**
 * Validation schema for workout exercise create/update operations.
 */
export const exerciseSchema = z.object({
  main_category: z
    .string()
    .min(1, "נדרשת קטגוריה ראשית")
    .max(120, "שם קטגוריה ארוך מדי"),
  sub_category: z.string().max(120, "שם תת-קטגוריה ארוך מדי").nullable().optional(),
  name_he: z.string().max(200, "שם בעברית ארוך מדי").nullable().optional(),
  name_en: z.string().max(200, "שם באנגלית ארוך מדי").nullable().optional(),
  equipment: z.string().max(200, "שם ציוד ארוך מדי").nullable().optional(),
  cues_he: z.string().max(1000, "הוראות ביצוע ארוכות מדי").nullable().optional(),
  goal_he: z.string().max(500, "תיאור מטרה ארוך מדי").nullable().optional(),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
