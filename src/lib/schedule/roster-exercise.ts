import { formatDuration } from "@/lib/utils/performance-profile";

/**
 * One exercise line as the calendar's roster sheet reads it: the name a
 * trainer recognises and the target in one short string.
 *
 * The sheet is a glance, not the builder, so the target is a single line
 * rather than the pills the trainee's workout screen renders.
 */

/** Just the target columns of a session exercise, so callers may pass a row. */
export interface ExerciseTarget {
  target_sets: number | null;
  target_reps_he: string | null;
  target_reps: number | null;
  target_load_he: string | null;
  target_weight_kg: number | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
}

export interface RosterExercise {
  id: string;
  /** Hebrew name, falling back to English and then to a generic label. */
  name: string;
  /** Empty when the trainer set no target at all. */
  target: string;
  notes: string | null;
}

/**
 * A built session as the roster sheet reads it. A trainee with nothing built
 * has no entry at all, so there is no "empty session" state to tell apart.
 */
export interface RosterSession {
  id: string;
  completed_at: string | null;
  exercises: RosterExercise[];
}

/** A session-exercise row as the roster query selects it. */
export interface SessionExerciseRow extends ExerciseTarget {
  id: string;
  order_index: number;
  notes_he: string | null;
  /** The joined library row; null when it could not be read. */
  exercise: { name_he: string | null; name_en: string | null } | null;
}

/**
 * `3×8-10 · 40 ק"ג`. The free text wins over the numeric column where both
 * exist: a trainer who typed "עד כשל" meant it to be read that way.
 */
export function formatExerciseTarget(target: ExerciseTarget): string {
  const reps = target.target_reps_he || (target.target_reps !== null ? `${target.target_reps}` : null);
  const setsReps = [target.target_sets !== null ? `${target.target_sets}` : null, reps]
    .filter(Boolean)
    .join("×");

  const load =
    target.target_load_he ?? (target.target_weight_kg !== null ? `${target.target_weight_kg} ק"ג` : null);
  const duration = target.target_duration_seconds !== null ? formatDuration(target.target_duration_seconds) : null;
  const distance = target.target_distance_m !== null ? `${target.target_distance_m} מ׳` : null;

  return [setsReps || null, load, duration, distance].filter(Boolean).join(" · ");
}

/** Ordered the way the trainer built the session, not the way PostgREST returned it. */
export function toRosterExercises(rows: SessionExerciseRow[]): RosterExercise[] {
  return [...rows]
    .sort((a, b) => a.order_index - b.order_index)
    .map((row) => ({
      id: row.id,
      name: row.exercise?.name_he ?? row.exercise?.name_en ?? "תרגיל",
      target: formatExerciseTarget(row),
      notes: row.notes_he,
    }));
}
