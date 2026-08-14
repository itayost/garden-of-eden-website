import { z } from "zod";

import { UUID_REGEX } from "@/lib/validations/common";
import {
  MEASURE_DEFS,
  distanceMSchema,
  durationSecondsSchema,
  measureDefaultsShape,
  optionalNumber,
  repsSchema,
  setsSchema,
  weightKgSchema,
} from "@/lib/validations/measures";

const MAX_NOTE_LENGTH = 300;
const MAX_NAME_LENGTH = 100;
const MAX_HOWTO_LENGTH = 1000;
const MAX_WEIGHT_STEP_KG = 50;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

// ---------------------------------------------------------------------------
// Exercise logs — what the trainee actually did
// ---------------------------------------------------------------------------

export const exerciseLogSchema = z
  .object({
    exerciseId: uuidSchema,
    sessionExerciseId: uuidSchema.nullish().transform((v) => v ?? null),
    equipmentId: uuidSchema.nullish().transform((v) => v ?? null),
    sets: setsSchema,
    reps: repsSchema,
    weightKg: weightKgSchema,
    durationSeconds: durationSecondsSchema,
    distanceM: distanceMSchema,
    note: optionalText(MAX_NOTE_LENGTH),
  })
  // A log with no numbers at all records nothing — require at least one.
  // Widened in Phase 4: a treadmill log is legitimately time and distance
  // with no sets, reps or weight anywhere.
  .refine(
    (v) =>
      v.sets !== null ||
      v.reps !== null ||
      v.weightKg !== null ||
      v.durationSeconds !== null ||
      v.distanceM !== null,
    {
      message: "יש למלא לפחות סטים, חזרות, משקל, זמן או מרחק",
      path: ["sets"],
    },
  );

// ---------------------------------------------------------------------------
// Equipment — the catalog and its performance profile
// ---------------------------------------------------------------------------

const trackingShape = {
  tracksWeight: z.boolean(),
  tracksReps: z.boolean(),
  tracksDuration: z.boolean(),
  tracksDistance: z.boolean(),
} as const;

const weightScaleShape = {
  weightMinKg: weightKgSchema,
  weightMaxKg: weightKgSchema,
  // Zero is not a usable increment, so the lower bound is exclusive — hence
  // the extra refine on top of the shared range check.
  weightStepKg: optionalNumber(0, MAX_WEIGHT_STEP_KG, "קפיצות משקל לא תקינות")
    .optional()
    .transform((v) => v ?? null)
    .refine((v) => v === null || v > 0, { message: "קפיצות משקל לא תקינות" }),
} as const;

const equipmentBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "נדרש שם לציוד")
    .max(MAX_NAME_LENGTH, "השם ארוך מדי"),
  notes: optionalText(MAX_NOTE_LENGTH),
  howto: optionalText(MAX_HOWTO_LENGTH),
  ...trackingShape,
  ...measureDefaultsShape,
  ...weightScaleShape,
});

type EquipmentBase = z.infer<typeof equipmentBaseSchema>;

/**
 * Cross-field rules the DB also enforces. Duplicated in Zod so the admin sees
 * a Hebrew message instead of a raw Postgres constraint violation.
 *
 * Shared by create and update via superRefine: the update schema's value is a
 * superset of the base, so it satisfies this signature structurally.
 */
function checkEquipment(v: EquipmentBase, ctx: z.RefinementCtx): void {
  if (!MEASURE_DEFS.some((measure) => v[measure.field])) {
    ctx.addIssue({
      code: "custom",
      message: "יש לבחור לפחות מדד אחד שהמכשיר מודד",
      path: ["tracksWeight"],
    });
  }

  if (
    v.weightMinKg !== null &&
    v.weightMaxKg !== null &&
    v.weightMinKg > v.weightMaxKg
  ) {
    ctx.addIssue({
      code: "custom",
      message: "המשקל המינימלי גדול מהמקסימלי",
      path: ["weightMinKg"],
    });
  }

  // A default for a measure the machine does not track is dead data that
  // would silently prefill a field nobody can see.
  for (const measure of MEASURE_DEFS) {
    if (!v[measure.field] && v[measure.defaultField] !== null) {
      ctx.addIssue({
        code: "custom",
        message: `אי אפשר לקבוע ${measure.label} ברירת מחדל למכשיר שלא מודד ${measure.label}`,
        path: [measure.defaultField],
      });
    }
  }
}

export const equipmentCreateSchema =
  equipmentBaseSchema.superRefine(checkEquipment);

/**
 * What the dialog binds to. Carries `isActive` (the edit-mode switch) but not
 * `equipmentId`, which the component supplies at submit time — a form has no
 * business holding a placeholder id while creating.
 */
export const equipmentFormSchema = equipmentBaseSchema
  .extend({ isActive: z.boolean() })
  .superRefine(checkEquipment);

export const equipmentUpdateSchema = equipmentBaseSchema
  .extend({
    equipmentId: uuidSchema,
    isActive: z.boolean(),
  })
  .superRefine(checkEquipment);

export type ExerciseLogInput = z.input<typeof exerciseLogSchema>;
export type EquipmentCreateInput = z.input<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.input<typeof equipmentUpdateSchema>;
export type EquipmentFormInput = z.input<typeof equipmentFormSchema>;
