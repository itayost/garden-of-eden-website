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

/**
 * Trim and collapse inner whitespace. The category column is free text, so
 * without this "כוח  מתפרץ" and "כוח מתפרץ" become two categories that read
 * as one.
 */
export function normalizeCategoryName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** The categories actually in use, which is what the pickers offer. */
export function deriveMainCategories(
  exercises: Pick<WorkoutExercise, "mainCategory">[]
): string[] {
  const set = new Set<string>();
  for (const e of exercises) {
    const name = normalizeCategoryName(e.mainCategory);
    if (name) set.add(name);
  }
  return [...set].sort();
}

/** Same name to a human, different string to Postgres: spacing, dash shape, case. */
function comparableCategory(value: string): string {
  return normalizeCategoryName(value)
    .toLowerCase()
    .replace(/[־‐-―-]/g, "-");
}

/**
 * An existing category that a typed name would duplicate without replacing.
 * Null when the name is new, or already exactly one of the existing ones.
 */
export function findSimilarCategory(
  value: string,
  existing: readonly string[]
): string | null {
  const target = comparableCategory(value);
  if (!target) return null;
  return existing.find((name) => name !== value && comparableCategory(name) === target) ?? null;
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
