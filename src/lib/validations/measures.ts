import { z } from "zod";

/**
 * The five things the studio measures, and their bounds.
 *
 * One definition shared by every schema that touches them — equipment
 * defaults, session targets and trainee logs — so a default can never be a
 * value the trainee is then forbidden from logging. The DB CHECKs in
 * `20260814100000_equipment_performance_profile.sql` mirror these exactly.
 */

/**
 * The four measures a machine can declare, in display order.
 *
 * One row per measure carrying every name it goes by: the DB flag column, the
 * camelCase form field, the default-value field it owns, and its Hebrew
 * label. The equipment form, the measure chips and the cross-field validation
 * all map over this instead of restating the list.
 */
export const MEASURE_DEFS = [
  {
    column: "tracks_weight",
    field: "tracksWeight",
    defaultField: "defaultWeightKg",
    label: "משקל",
  },
  {
    column: "tracks_reps",
    field: "tracksReps",
    defaultField: "defaultReps",
    label: "חזרות",
  },
  {
    column: "tracks_duration",
    field: "tracksDuration",
    defaultField: "defaultDurationSeconds",
    label: "זמן",
  },
  {
    column: "tracks_distance",
    field: "tracksDistance",
    defaultField: "defaultDistanceM",
    label: "מרחק",
  },
] as const;

export type MeasureDef = (typeof MEASURE_DEFS)[number];
export type MeasureFlagColumn = MeasureDef["column"];
export type MeasureFlagField = MeasureDef["field"];
export type MeasureDefaultField = MeasureDef["defaultField"];

export const MEASURE_BOUNDS = {
  sets: { min: 1, max: 99 },
  reps: { min: 1, max: 999 },
  weightKg: { min: 0, max: 500 },
  /** 24 hours. Generous on purpose; the cap exists to stop nonsense, not to model a session. */
  durationSeconds: { min: 1, max: 86400 },
  distanceM: { min: 1, max: 100000 },
} as const;

/**
 * Form fields submit "" or a number-ish string; the DB stores a number or
 * NULL. Empty, null and undefined all mean "not provided".
 */
export const optionalNumber = (min: number, max: number, message: string) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    })
    .refine((v) => v === null || (!Number.isNaN(v) && v >= min && v <= max), {
      message,
    });

/**
 * Makes the key itself omittable while keeping the parsed type `number | null`.
 * Omitting a measure is how a caller says "this one does not apply", which is
 * the common case: a rope log has no weight, a squat log has no distance.
 */
const omittable = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().transform((v) => v ?? null);

/** Same as optionalNumber, but truncated to an integer after the range check. */
const optionalInt = (min: number, max: number, message: string) =>
  optionalNumber(min, max, message).transform((v) =>
    v === null ? null : Math.trunc(v),
  );

export const setsSchema = omittable(
  optionalInt(MEASURE_BOUNDS.sets.min, MEASURE_BOUNDS.sets.max, "מספר סטים לא תקין"),
);

export const repsSchema = omittable(
  optionalInt(MEASURE_BOUNDS.reps.min, MEASURE_BOUNDS.reps.max, "מספר חזרות לא תקין"),
);

export const weightKgSchema = omittable(
  optionalNumber(
    MEASURE_BOUNDS.weightKg.min,
    MEASURE_BOUNDS.weightKg.max,
    "משקל לא תקין",
  ),
);

export const durationSecondsSchema = omittable(
  optionalInt(
    MEASURE_BOUNDS.durationSeconds.min,
    MEASURE_BOUNDS.durationSeconds.max,
    "משך זמן לא תקין",
  ),
);

export const distanceMSchema = omittable(
  optionalInt(
    MEASURE_BOUNDS.distanceM.min,
    MEASURE_BOUNDS.distanceM.max,
    "מרחק לא תקין",
  ),
);

/** The measure columns shared by equipment defaults and exercise overrides. */
export const measureDefaultsShape = {
  defaultSets: setsSchema,
  defaultReps: repsSchema,
  defaultWeightKg: weightKgSchema,
  defaultDurationSeconds: durationSecondsSchema,
  defaultDistanceM: distanceMSchema,
} as const;
