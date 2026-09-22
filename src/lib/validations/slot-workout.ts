import { z } from "zod";

import {
  MAX_EXERCISES_PER_SESSION,
  MAX_TEXT_LENGTH,
  optionalText,
  sessionExerciseSchema,
  uuidSchema,
} from "@/lib/validations/training-session";

/**
 * A slot's group workout.
 *
 * Deliberately without the `.min(1)` that upsertSessionSchema carries: an
 * empty list here is not a mistake but the request to remove the group
 * workout, and the action routes it to clear_slot_workout. The row shape is
 * the session's own, so a target that saves here is one the fan-out can write.
 */
export const saveSlotWorkoutSchema = z.object({
  slotId: uuidSchema,
  notes: optionalText(MAX_TEXT_LENGTH),
  exercises: z
    .array(sessionExerciseSchema)
    .max(MAX_EXERCISES_PER_SESSION, "יותר מדי תרגילים באימון"),
});

export type SaveSlotWorkoutInput = z.input<typeof saveSlotWorkoutSchema>;
