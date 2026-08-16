/**
 * Turns every source of session rows into `SessionBuilderRow[]`.
 *
 * Sources: the exercise library picker, a workout program week, a saved
 * session template, the previous session, and the session being edited.
 *
 * Programs are copy SOURCES for daily sessions, never assignments — the
 * trainer pulls one week's prescriptions as a starting point and edits from
 * there. See the phase-2 section of the pipeline spec.
 */

import { numText, resolveDefaults } from "@/lib/utils/performance-profile";
import type { ProgramGrid, WorkoutExercise } from "@/features/workouts/lib/types";
import type { SessionTemplate } from "@/types/session-template";
import type {
  SessionBuilderRow,
  SessionEquipmentRef,
} from "@/types/training-session";

/**
 * One builder row with every field present.
 *
 * Rows are created in five places (picker, program import, template import,
 * previous-session duplicate, existing-session load) and a row missing a field
 * silently drops that target on save, so they all go through here.
 */
export function makeBuilderRow(
  base: Pick<SessionBuilderRow, "key" | "exerciseId" | "exerciseName"> &
    Partial<SessionBuilderRow>,
): SessionBuilderRow {
  return {
    targetSets: null,
    targetReps: "",
    targetLoad: "",
    targetRepsNum: "",
    targetWeightKg: "",
    targetDurationSeconds: "",
    targetDistanceM: "",
    notes: "",
    equipment: null,
    ...base,
  };
}

/** Seeds a row's numeric targets from the machine's resolved defaults. */
export function seedRowFromEquipment(
  row: SessionBuilderRow,
  equipment: SessionEquipmentRef | null,
  defaults: {
    sets: number | null;
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
    distanceM: number | null;
  },
): SessionBuilderRow {
  return {
    ...row,
    equipment,
    targetSets: defaults.sets,
    targetRepsNum: equipment?.tracks_reps ? numText(defaults.reps) : "",
    targetWeightKg: equipment?.tracks_weight ? numText(defaults.weightKg) : "",
    targetDurationSeconds: equipment?.tracks_duration
      ? numText(defaults.durationSeconds)
      : "",
    targetDistanceM: equipment?.tracks_distance ? numText(defaults.distanceM) : "",
    seededFromEquipment:
      defaults.sets !== null ||
      defaults.reps !== null ||
      defaults.weightKg !== null ||
      defaults.durationSeconds !== null ||
      defaults.distanceM !== null,
  };
}

/**
 * Builder rows as the exercise payload both `upsertSessionAction` and the
 * template actions accept.
 *
 * The two schemas share `sessionExerciseSchema`, so they share this mapping —
 * a field added to a row must reach both, and two copies would drift.
 */
export function rowsToExerciseInput(rows: SessionBuilderRow[]) {
  return rows.map((row) => ({
    exerciseId: row.exerciseId,
    targetSets: row.targetSets,
    targetReps: row.targetReps,
    targetLoad: row.targetLoad,
    targetRepsNum: row.targetRepsNum,
    targetWeightKg: row.targetWeightKg,
    targetDurationSeconds: row.targetDurationSeconds,
    targetDistanceM: row.targetDistanceM,
    notes: row.notes,
  }));
}

/**
 * One library exercise as a builder row, targets already seeded from the
 * machine it runs on.
 *
 * The picker's rows carry the machine's profile (EXERCISE_SELECT embeds it),
 * so this stays synchronous — no round trip per exercise, and no row that
 * appears blank and then fills in.
 */
export function exerciseToBuilderRow(
  exercise: WorkoutExercise,
  key: string,
): SessionBuilderRow {
  const row = makeBuilderRow({
    key,
    exerciseId: exercise.id,
    exerciseName: exercise.nameHe ?? exercise.nameEn ?? "תרגיל",
  });

  const machine = exercise.equipmentProfile;
  if (!machine) return row;

  const defaults = resolveDefaults(
    {
      default_sets: exercise.defaultSets,
      default_reps: exercise.defaultReps,
      default_weight_kg: exercise.defaultWeightKg,
      default_duration_seconds: exercise.defaultDurationSeconds,
      default_distance_m: exercise.defaultDistanceM,
    },
    machine,
  );

  return seedRowFromEquipment(row, machine, defaults);
}

/**
 * A saved template as builder rows.
 *
 * Unlike a program week, this restores EVERY field — the four numeric targets
 * and the machine profile — so the imported rows render the same inputs the
 * trainer filled in when saving. That round trip is the reason templates have
 * their own tables instead of being 1-week programs.
 *
 * `seededFromEquipment` stays false: these are the trainer's own saved
 * numbers, and the "ברירת מחדל מהציוד" badge would be claiming otherwise.
 */
export function templateToBuilderRows(
  template: SessionTemplate,
): SessionBuilderRow[] {
  return template.exercises.map((exercise, index) =>
    makeBuilderRow({
      key: `template-${exercise.exercise_id}-${index}`,
      exerciseId: exercise.exercise_id,
      exerciseName:
        exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל",
      targetSets: exercise.target_sets,
      targetReps: exercise.target_reps_he ?? "",
      targetLoad: exercise.target_load_he ?? "",
      targetRepsNum: numText(exercise.target_reps),
      targetWeightKg: numText(exercise.target_weight_kg),
      targetDurationSeconds: numText(exercise.target_duration_seconds),
      targetDistanceM: numText(exercise.target_distance_m),
      notes: exercise.notes_he ?? "",
      equipment: exercise.exercise?.equipment_ref ?? null,
      seededFromEquipment: false,
    }),
  );
}

export function programWeekToBuilderRows(
  grid: ProgramGrid,
  week: number,
): SessionBuilderRow[] {
  const clampedWeek = Math.min(Math.max(week, 1), grid.program.weeks);

  return grid.rows.map((row, index) => {
    const cell = row.cells[clampedWeek - 1];
    return makeBuilderRow({
      key: `import-${row.exerciseId}-${index}`,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      targetSets: cell?.sets ?? null,
      targetReps: cell?.repsHe ?? "",
      targetLoad: cell?.loadHe ?? "",
      notes: cell?.notesHe ?? "",
    });
  });
}
