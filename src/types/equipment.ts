/**
 * Equipment (ציוד) — the studio's machines/stations, each carrying a short
 * code printed as a QR sticker that encodes /dashboard/scan/<code>.
 *
 * Not in generated Supabase types; reads go through `typedFrom()`.
 */

export interface Equipment {
  id: string;
  name_he: string;
  /** Short code embedded in the QR URL. Generated once, never edited. */
  code: string;
  is_active: boolean;
  notes_he: string | null;

  /**
   * What this machine can measure. Physical properties, so an exercise cannot
   * override them: a jump rope has no weight stack. At least one is true.
   */
  tracks_weight: boolean;
  tracks_reps: boolean;
  tracks_duration: boolean;
  tracks_distance: boolean;

  /** Starting numbers. An exercise may override any of them. */
  default_sets: number | null;
  default_reps: number | null;
  default_weight_kg: number | null;
  default_duration_seconds: number | null;
  default_distance_m: number | null;

  /** The stack: drives the stepper increment and clamps a mistyped load. */
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  weight_step_kg: number;

  /** Setup notes for the machine. Not how to perform the exercise. */
  howto_he: string | null;

  created_at: string;
  updated_at: string;
}

/** Catalog row plus how many library exercises point at it. */
export interface EquipmentWithUsage extends Equipment {
  exerciseCount: number;
}

/**
 * The subset of `equipment` needed to render a measure-aware form.
 *
 * Everything that resolves a profile embeds exactly these columns, so a row
 * arriving from the exercise library and one arriving from a session drive
 * the same inputs. `code` is deliberately absent — no profile consumer shows
 * it; only the catalog and sticker sheet do.
 */
export const EQUIPMENT_PROFILE_COLUMNS =
  "id, name_he, tracks_weight, tracks_reps, tracks_duration, tracks_distance, default_sets, default_reps, default_weight_kg, default_duration_seconds, default_distance_m, weight_min_kg, weight_max_kg, weight_step_kg, howto_he";

/** A machine's profile as embedded by EQUIPMENT_PROFILE_COLUMNS. */
export type EquipmentProfile = Pick<
  Equipment,
  | "id"
  | "name_he"
  | "tracks_weight"
  | "tracks_reps"
  | "tracks_duration"
  | "tracks_distance"
  | "default_sets"
  | "default_reps"
  | "default_weight_kg"
  | "default_duration_seconds"
  | "default_distance_m"
  | "weight_min_kg"
  | "weight_max_kg"
  | "howto_he"
> & { weight_step_kg: number | null };

export interface ExerciseLog {
  id: string;
  trainee_id: string;
  exercise_id: string;
  session_exercise_id: string | null;
  equipment_id: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  note_he: string | null;
  logged_at: string;
}

/** The scan URL printed on each sticker. */
export function equipmentScanUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/dashboard/scan/${code}`;
}
