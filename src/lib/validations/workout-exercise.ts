import { z } from "zod";

import { UUID_REGEX } from "@/lib/validations/common";
import {
  distanceMSchema,
  durationSecondsSchema,
  repsSchema,
  setsSchema,
  weightKgSchema,
} from "@/lib/validations/measures";

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
  // Structured link to the equipment catalog (QR scan matching). The free-text
  // `equipment` column above stays as a display fallback.
  equipment_id: z
    .string()
    .regex(UUID_REGEX, "מזהה ציוד לא תקין")
    .nullable()
    .optional(),
  cues_he: z.string().max(1000, "הוראות ביצוע ארוכות מדי").nullable().optional(),
  goal_he: z.string().max(500, "תיאור מטרה ארוך מדי").nullable().optional(),
  // Per-exercise overrides of the machine's defaults. Empty means inherit —
  // a cable tower hosts three exercises with three different rep schemes.
  default_sets: setsSchema,
  default_reps: repsSchema,
  default_weight_kg: weightKgSchema,
  default_duration_seconds: durationSecondsSchema,
  default_distance_m: distanceMSchema,
});

/**
 * What the form submits. `z.input`, not `z.infer`: the measure fields accept
 * "" off a text input and only become `number | null` after parsing.
 */
export type ExerciseInput = z.input<typeof exerciseSchema>;

/** What the action receives after a successful parse. */
export type ExerciseParsed = z.output<typeof exerciseSchema>;
