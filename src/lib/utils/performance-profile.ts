/**
 * Resolves what a machine can measure and what numbers to start from.
 *
 * The rule lives here and only here, because three surfaces consume it and
 * they must not drift: the admin equipment form, the trainer's session
 * builder, and the trainee's log dialog.
 *
 * Two separate concerns, deliberately not merged:
 *
 * - TRACKING is physical. A jump rope has no weight stack; that is a property
 *   of the equipment and an exercise cannot override it.
 * - DEFAULTS are editorial. A cable tower hosts a row, a curl and a pushdown
 *   on one machine but three different rep schemes, so an exercise may
 *   override the numbers. NULL means inherit.
 *
 * An exercise with no equipment at all resolves to FALLBACK_TRACKING_PROFILE,
 * which is byte-for-byte the form that shipped before this module existed.
 */

/**
 * Default weight increment when a machine does not specify one. Also the DB
 * default for `equipment.weight_step_kg` — the action imports it from here so
 * the two cannot drift.
 */
export const DEFAULT_WEIGHT_STEP_KG = 2.5;

export interface TrackingProfile {
  tracksWeight: boolean;
  tracksReps: boolean;
  tracksDuration: boolean;
  tracksDistance: boolean;
  weightMinKg: number | null;
  weightMaxKg: number | null;
  weightStepKg: number;
}

export interface PerformanceDefaults {
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
}

/** The `equipment` columns this module reads. Loose so a raw row fits. */
export interface EquipmentProfileSource {
  tracks_weight?: boolean | null;
  tracks_reps?: boolean | null;
  tracks_duration?: boolean | null;
  tracks_distance?: boolean | null;
  default_sets?: number | null;
  default_reps?: number | null;
  default_weight_kg?: number | null;
  default_duration_seconds?: number | null;
  default_distance_m?: number | null;
  weight_min_kg?: number | null;
  weight_max_kg?: number | null;
  weight_step_kg?: number | null;
}

/** The `workout_exercises` override columns. NULL means inherit. */
export interface ExerciseDefaultsSource {
  default_sets?: number | null;
  default_reps?: number | null;
  default_weight_kg?: number | null;
  default_duration_seconds?: number | null;
  default_distance_m?: number | null;
}

/**
 * Sets, reps and weight with a 2.5kg step and no bounds — exactly what every
 * exercise showed before machines could describe themselves. Used for
 * exercises with no equipment, and as a safety net for a row whose flags are
 * all false (the DB CHECK forbids that, but a dialog with no inputs is worse
 * than a wrong one).
 */
export const FALLBACK_TRACKING_PROFILE: TrackingProfile = {
  tracksWeight: true,
  tracksReps: true,
  tracksDuration: false,
  tracksDistance: false,
  weightMinKg: null,
  weightMaxKg: null,
  weightStepKg: DEFAULT_WEIGHT_STEP_KG,
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Two decimal places, which is the precision of NUMERIC(5,2) in the DB. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveTrackingProfile(
  equipment: EquipmentProfileSource | null | undefined,
): TrackingProfile {
  if (!equipment) return FALLBACK_TRACKING_PROFILE;

  const tracksWeight = equipment.tracks_weight ?? false;
  const tracksReps = equipment.tracks_reps ?? false;
  const tracksDuration = equipment.tracks_duration ?? false;
  const tracksDistance = equipment.tracks_distance ?? false;

  // No measurable dimension would render an empty dialog. Fall back instead.
  if (!tracksWeight && !tracksReps && !tracksDuration && !tracksDistance) {
    return FALLBACK_TRACKING_PROFILE;
  }

  const step = finiteOrNull(equipment.weight_step_kg);

  return {
    tracksWeight,
    tracksReps,
    tracksDuration,
    tracksDistance,
    weightMinKg: finiteOrNull(equipment.weight_min_kg),
    weightMaxKg: finiteOrNull(equipment.weight_max_kg),
    weightStepKg: step !== null && step > 0 ? step : DEFAULT_WEIGHT_STEP_KG,
  };
}

/**
 * Per measure: the exercise's own value, else the machine's, else null.
 *
 * `??` and not `||` on purpose — 0 is a legitimate default on a
 * bodyweight-assisted machine and must not fall through to the equipment.
 */
export function resolveDefaults(
  exercise: ExerciseDefaultsSource | null | undefined,
  equipment: EquipmentProfileSource | null | undefined,
): PerformanceDefaults {
  const pick = (
    key: keyof ExerciseDefaultsSource & keyof EquipmentProfileSource,
  ): number | null =>
    finiteOrNull(exercise?.[key]) ?? finiteOrNull(equipment?.[key]);

  return {
    sets: pick("default_sets"),
    reps: pick("default_reps"),
    weightKg: pick("default_weight_kg"),
    durationSeconds: pick("default_duration_seconds"),
    distanceM: pick("default_distance_m"),
  };
}

/**
 * The three one-tap weight bumps, derived from the machine's own increment
 * rather than a fixed [1, 2.5, 5]. A 5kg stack offers +5 / +10 / +20; the
 * 2.5 default reproduces the familiar plate ladder.
 */
export function weightQuickAdds(stepKg: number): number[] {
  const step =
    Number.isFinite(stepKg) && stepKg > 0 ? stepKg : DEFAULT_WEIGHT_STEP_KG;
  return [step, step * 2, step * 4].map(round2);
}

export interface StepBounds {
  min: number | null;
  max: number | null;
  step: number;
}

/**
 * Snaps a value onto the machine's increments and clamps it to the stack.
 *
 * Snapping is measured from `min` where one exists, so a stack that starts at
 * 5 and steps by 5 yields 5, 10, 15 rather than 0, 5, 10. Returns null for a
 * non-finite input so a caller can leave the field empty instead of writing
 * NaN.
 */
export function clampToStep(
  value: number | null | undefined,
  { min, max, step }: StepBounds,
): number | null {
  const numeric = finiteOrNull(value);
  if (numeric === null) return null;

  const increment = Number.isFinite(step) && step > 0 ? step : DEFAULT_WEIGHT_STEP_KG;
  const origin = min ?? 0;

  const snapped = origin + Math.round((numeric - origin) / increment) * increment;

  const lowerBounded = min !== null ? Math.max(snapped, min) : snapped;
  const bounded = max !== null ? Math.min(lowerBounded, max) : lowerBounded;

  return round2(bounded);
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** `mm:ss`, growing to `h:mm:ss` past an hour. Empty string for null. */
export function formatDuration(seconds: number | null | undefined): string {
  const total = finiteOrNull(seconds);
  if (total === null) return "";

  const whole = Math.max(0, Math.trunc(total));
  const hours = Math.floor(whole / SECONDS_PER_HOUR);
  const minutes = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = whole % SECONDS_PER_MINUTE;

  const pad = (n: number) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

/** A row of measures as stored, for display. Every field optional. */
export interface MeasureValues {
  sets?: number | null;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
}

/**
 * A set of measures as one Hebrew line.
 *
 * The single renderer for "what was done" and "what was done last time",
 * used by the trainee's session list, the trainer's actuals column and the
 * log dialog's hint. `compact` swaps the spelled-out sets/reps for "3 × 10",
 * which is the only thing those three surfaces disagreed about.
 */
export function formatMeasures(
  values: MeasureValues,
  { compact = false }: { compact?: boolean } = {},
): string {
  const parts: string[] = [];
  const { sets, reps } = values;

  if (compact && sets && reps) {
    parts.push(`${sets} × ${reps}`);
  } else {
    if (sets) parts.push(`${sets} סטים`);
    if (reps) parts.push(`${reps} חזרות`);
  }

  if (values.weight_kg !== null && values.weight_kg !== undefined)
    parts.push(`${values.weight_kg} ק"ג`);
  if (values.duration_seconds) parts.push(formatDuration(values.duration_seconds));
  if (values.distance_m) parts.push(`${values.distance_m} מ׳`);

  return parts.join(" · ");
}

/** "" for a null number, so an input renders empty rather than "0". */
export function numText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
