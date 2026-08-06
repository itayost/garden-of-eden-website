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

/** PostgREST select string for a session with its exercises and their library rows. */
export const SESSION_SELECT_WITH_EXERCISES =
  "*, exercises:training_session_exercises(id, session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment))";

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_he: string | null;
  target_load_he: string | null;
  notes_he: string | null;
  /** Joined library row, for display. */
  exercise?: {
    id: string;
    name_he: string | null;
    name_en: string | null;
    main_category: string;
    sub_category: string | null;
    equipment: string | null;
  } | null;
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
  notes: string;
}
