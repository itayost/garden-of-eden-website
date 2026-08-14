import {
  EQUIPMENT_PROFILE_COLUMNS,
  type EquipmentProfile,
} from "@/types/equipment";

/**
 * Training sessions (שיבוץ אימונים) — Phase 2 of the studio training pipeline.
 *
 * A training session is the per-trainee plan for one calendar day, built by a
 * trainer from the workout_exercises library. Not a Slot (the group plan) and
 * not a Program (a multi-week template used only as a copy source).
 *
 * Tables are not in the generated Supabase types; reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

/**
 * PostgREST select string for a session with its exercises, their library
 * rows, and any logs. For staff the logs embed shows what was actually done;
 * RLS scopes which log rows each caller sees.
 */
export const SESSION_SELECT_WITH_EXERCISES =
  `*, exercises:training_session_exercises(id, session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment, equipment_id, cues_he, default_sets, default_reps, default_weight_kg, default_duration_seconds, default_distance_m, equipment_ref:equipment(${EQUIPMENT_PROFILE_COLUMNS})), logs:exercise_logs(id, sets, reps, weight_kg, duration_seconds, distance_m, note_he, logged_at))`;

/** The equipment profile embedded alongside a session exercise. */
export type SessionEquipmentRef = EquipmentProfile;

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_he: string | null;
  target_load_he: string | null;
  /** Numeric targets, beside the free text rather than instead of it. */
  target_reps: number | null;
  target_weight_kg: number | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
  notes_he: string | null;
  /** Joined library row, for display. */
  exercise?: {
    id: string;
    name_he: string | null;
    name_en: string | null;
    main_category: string;
    sub_category: string | null;
    equipment: string | null;
    equipment_id?: string | null;
    cues_he?: string | null;
    /** Per-exercise overrides; NULL means inherit from equipment_ref. */
    default_sets?: number | null;
    default_reps?: number | null;
    default_weight_kg?: number | null;
    default_duration_seconds?: number | null;
    default_distance_m?: number | null;
    /** The linked machine's profile, driving which inputs render. */
    equipment_ref?: SessionEquipmentRef | null;
  } | null;
  /** The trainee's logs for this session exercise (trainee/staff views). */
  logs?: {
    id: string;
    sets: number | null;
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_m: number | null;
    note_he: string | null;
    logged_at: string;
  }[];
}

export interface TrainingSession {
  id: string;
  trainee_id: string;
  /** ISO YYYY-MM-DD. One session per trainee per day. */
  session_date: string;
  /** The schedule slot this was built from; survives slot deletion as NULL. */
  slot_id: string | null;
  built_by: string;
  built_by_name: string;
  notes_he: string | null;
  /** Set in Phase 3 when the trainee finishes logging. */
  completed_at: string | null;
  exercises: SessionExercise[];
  created_at: string;
  updated_at: string;
}

/** Per-trainee summary for the schedule page's slot cards. */
export interface SessionSummary {
  id: string;
  trainee_id: string;
  exerciseCount: number;
  completed_at: string | null;
}

/** One editable row in the session builder. */
export interface SessionBuilderRow {
  /** Stable client key. */
  key: string;
  exerciseId: string;
  exerciseName: string;
  targetSets: number | null;
  targetReps: string;
  targetLoad: string;
  /** Numeric targets. Strings because they come straight off form inputs. */
  targetRepsNum: string;
  targetWeightKg: string;
  targetDurationSeconds: string;
  targetDistanceM: string;
  notes: string;
  /**
   * The linked machine's profile, resolved when the row was added. Decides
   * which inputs this row renders; null means a plain free-text row.
   */
  equipment: SessionEquipmentRef | null;
  /** True when the targets were seeded from the machine and not yet edited. */
  seededFromEquipment?: boolean;
}
