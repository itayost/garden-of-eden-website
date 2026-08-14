/**
 * Imports a week column of a workout program into the session builder.
 *
 * Programs are copy SOURCES for daily sessions, never assignments — the
 * trainer pulls one week's prescriptions as a starting point and edits from
 * there. See the phase-2 section of the pipeline spec.
 */

import { numText } from "@/lib/utils/performance-profile";
import type { ProgramGrid } from "@/features/workouts/lib/types";
import type {
  SessionBuilderRow,
  SessionEquipmentRef,
} from "@/types/training-session";

/**
 * One builder row with every field present.
 *
 * Rows are created in four places (picker, program import, previous-session
 * duplicate, existing-session load) and a row missing a field silently drops
 * that target on save, so they all go through here.
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
