import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

const MAX_TEXT_LENGTH = 300;
const MAX_SETS = 99;
/** Guardrail; a daily session for this age group is a handful of exercises. */
const MAX_EXERCISES_PER_SESSION = 40;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const dateSchema = z.string().refine(isValidDateString, "תאריך לא תקין");

/** Trims, then treats an empty string as "no value" so the DB stores NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

/** Form fields submit "" or a number-ish string; the DB stores int or NULL. */
const targetSetsSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  })
  .refine((v) => v === null || (v >= 1 && v <= MAX_SETS), {
    message: "מספר סטים לא תקין",
  });

const sessionExerciseSchema = z.object({
  exerciseId: uuidSchema,
  targetSets: targetSetsSchema,
  targetReps: optionalText(MAX_TEXT_LENGTH),
  targetLoad: optionalText(MAX_TEXT_LENGTH),
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
