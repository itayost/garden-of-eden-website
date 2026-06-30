import type { ProgramCell, WorkoutExercise } from "./types";

export function emptyCell(week: number): ProgramCell {
  return { week, sets: null, repsHe: "", loadHe: "", notesHe: "" };
}

export function resizeRowCells(cells: ProgramCell[], weeks: number): ProgramCell[] {
  // Place each cell into the slot matching its own `week`, not its array index,
  // so the result is correct regardless of input order (e.g. DB rows that come
  // back unordered). Missing weeks are filled with empty cells.
  const byWeek = new Map(cells.map((c) => [c.week, c]));
  return Array.from({ length: weeks }, (_, i) => {
    const week = i + 1;
    const existing = byWeek.get(week);
    return existing ? { ...existing, week } : emptyCell(week);
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
