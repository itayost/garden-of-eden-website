import { z } from "zod";

import {
  MAX_EXERCISES_PER_SESSION,
  MAX_TEXT_LENGTH,
  optionalText,
  sessionExerciseSchema,
  uuidSchema,
} from "@/lib/validations/training-session";

const MAX_NAME_LENGTH = 100;

/**
 * A template is a session minus the trainee, the date and the slot, plus a
 * name. The exercise rows reuse `sessionExerciseSchema` unchanged — the two
 * tables carry the same columns, and duplicating the schema would let them
 * drift apart.
 */
const templateBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "יש להזין שם לתבנית")
    .max(MAX_NAME_LENGTH, `השם ארוך מדי (מקסימום ${MAX_NAME_LENGTH} תווים)`),
  description: optionalText(MAX_TEXT_LENGTH),
  exercises: z
    .array(sessionExerciseSchema)
    .min(1, "יש להוסיף לפחות תרגיל אחד")
    .max(MAX_EXERCISES_PER_SESSION, "יותר מדי תרגילים בתבנית"),
});

export const createTemplateSchema = templateBodySchema;

export const updateTemplateSchema = templateBodySchema.extend({
  id: uuidSchema,
});

export const templateIdSchema = z.object({ templateId: uuidSchema });

export type CreateTemplateInput = z.input<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.input<typeof updateTemplateSchema>;
