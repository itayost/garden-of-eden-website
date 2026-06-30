import type { ProgramCell, WorkoutExercise } from "./types";

export function emptyCell(week: number): ProgramCell {
  return { week, sets: null, repsHe: "", loadHe: "", notesHe: "" };
}

export function resizeRowCells(cells: ProgramCell[], weeks: number): ProgramCell[] {
  return Array.from({ length: weeks }, (_, i) => {
    const existing = cells[i];
    return existing ? { ...existing, week: i + 1 } : emptyCell(i + 1);
  });
}

export function copyCellAcrossWeeks(cells: ProgramCell[], sourceWeekIndex: number): ProgramCell[] {
  const src = cells[sourceWeekIndex];
  if (!src) return cells.map((c) => ({ ...c }));
  return cells.map((c) => ({ week: c.week, sets: src.sets, repsHe: src.repsHe, loadHe: src.loadHe, notesHe: src.notesHe }));
}

export function deriveSubCategories(
  exercises: Pick<WorkoutExercise, "mainCategory" | "subCategory">[],
  mainCategory?: string
): string[] {
  const set = new Set<string>();
  for (const e of exercises) {
    if (mainCategory && e.mainCategory !== mainCategory) continue;
    if (e.subCategory) set.add(e.subCategory);
  }
  return [...set].sort();
}
