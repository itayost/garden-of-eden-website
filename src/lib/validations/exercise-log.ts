import { z } from "zod";

import { UUID_REGEX } from "@/lib/validations/common";

const MAX_NOTE_LENGTH = 300;
const MAX_NAME_LENGTH = 100;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

/** Form fields submit "" or a number-ish string; the DB stores int/numeric or NULL. */
const optionalNumber = (min: number, max: number, message: string) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((v) => v === null || (!Number.isNaN(v) && v >= min && v <= max), {
      message,
    });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const exerciseLogSchema = z
  .object({
    exerciseId: uuidSchema,
    sessionExerciseId: uuidSchema.nullish().transform((v) => v ?? null),
    equipmentId: uuidSchema.nullish().transform((v) => v ?? null),
    sets: optionalNumber(1, 99, "מספר סטים לא תקין").transform((v) =>
      v === null ? null : Math.trunc(v),
    ),
    reps: optionalNumber(1, 999, "מספר חזרות לא תקין").transform((v) =>
      v === null ? null : Math.trunc(v),
    ),
    weightKg: optionalNumber(0, 500, "משקל לא תקין"),
    note: optionalText(MAX_NOTE_LENGTH),
  })
  // A log with no numbers at all records nothing — require at least one.
  .refine((v) => v.sets !== null || v.reps !== null || v.weightKg !== null, {
    message: "יש למלא לפחות סטים, חזרות או משקל",
    path: ["sets"],
  });

export const equipmentCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "נדרש שם לציוד")
    .max(MAX_NAME_LENGTH, "השם ארוך מדי"),
  notes: optionalText(MAX_NOTE_LENGTH),
});

export const equipmentUpdateSchema = equipmentCreateSchema.extend({
  equipmentId: uuidSchema,
  isActive: z.boolean(),
});

export type ExerciseLogInput = z.input<typeof exerciseLogSchema>;
export type EquipmentCreateInput = z.input<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.input<typeof equipmentUpdateSchema>;
