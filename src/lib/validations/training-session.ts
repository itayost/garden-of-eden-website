import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";
import {
  distanceMSchema,
  durationSecondsSchema,
  repsSchema,
  setsSchema,
  weightKgSchema,
} from "@/lib/validations/measures";

export const MAX_TEXT_LENGTH = 300;
/** Guardrail; a daily session for this age group is a handful of exercises. */
export const MAX_EXERCISES_PER_SESSION = 40;

export const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const dateSchema = z.string().refine(isValidDateString, "תאריך לא תקין");

/** Trims, then treats an empty string as "no value" so the DB stores NULL. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

/**
 * One prescribed exercise row. Shared with the session-template schema: the
 * row shape is identical by design, and a second copy would drift.
 */
export const sessionExerciseSchema = z.object({
  exerciseId: uuidSchema,
  targetSets: setsSchema,
  // Free text stays: "8-10" and "עד כשל" are not numbers and should not have
  // to be. The numeric fields below sit beside them, not instead of them, and
  // are what make an actual-vs-target comparison possible.
  targetReps: optionalText(MAX_TEXT_LENGTH),
  targetLoad: optionalText(MAX_TEXT_LENGTH),
  targetRepsNum: repsSchema,
  targetWeightKg: weightKgSchema,
  targetDurationSeconds: durationSecondsSchema,
  targetDistanceM: distanceMSchema,
  notes: optionalText(MAX_TEXT_LENGTH),
});

export const upsertSessionSchema = z.object({
  traineeId: uuidSchema,
  sessionDate: dateSchema,
  slotId: uuidSchema.nullish().transform((v) => v ?? null),
  notes: optionalText(MAX_TEXT_LENGTH),
  exercises: z
    .array(sessionExerciseSchema)
    .min(1, "יש להוסיף לפחות תרגיל אחד")
    .max(MAX_EXERCISES_PER_SESSION, "יותר מדי תרגילים באימון"),
});

export const sessionIdSchema = z.object({ sessionId: uuidSchema });

export type UpsertSessionInput = z.input<typeof upsertSessionSchema>;
