/**
 * Imports a week column of a workout program into the session builder.
 *
 * Programs are copy SOURCES for daily sessions, never assignments — the
 * trainer pulls one week's prescriptions as a starting point and edits from
 * there. See the phase-2 section of the pipeline spec.
 */

import type { ProgramGrid } from "@/features/workouts/lib/types";
import type { SessionBuilderRow } from "@/types/training-session";

export function programWeekToBuilderRows(
  grid: ProgramGrid,
  week: number,
): SessionBuilderRow[] {
  const clampedWeek = Math.min(Math.max(week, 1), grid.program.weeks);

  return grid.rows.map((row, index) => {
    const cell = row.cells[clampedWeek - 1];
    return {
      key: `import-${row.exerciseId}-${index}`,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      targetSets: cell?.sets ?? null,
      targetReps: cell?.repsHe ?? "",
      targetLoad: cell?.loadHe ?? "",
      notes: cell?.notesHe ?? "",
    };
  });
}
