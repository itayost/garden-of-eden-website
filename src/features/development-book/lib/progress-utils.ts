import type { BookParameterWithChildren, DrillProgressMap } from "./types";

export function progressPercent(doneCount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((doneCount / total) * 100);
}

export function countDoneInParameter(
  param: BookParameterWithChildren,
  done: DrillProgressMap
): { done: number; total: number } {
  const total = param.drills.length;
  const doneCount = param.drills.reduce((n, d) => (done[d.id] ? n + 1 : n), 0);
  return { done: doneCount, total };
}
