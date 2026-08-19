import { progressPercent } from "@/lib/utils/math";
import type { BookParameterWithChildren, DrillProgressMap } from "./types";

// Was a local copy; the shared one additionally caps at 100.
export { progressPercent };

export function countDoneInParameter(
  param: BookParameterWithChildren,
  done: DrillProgressMap
): { done: number; total: number } {
  const total = param.drills.length;
  const doneCount = param.drills.reduce((n, d) => (done[d.id] ? n + 1 : n), 0);
  return { done: doneCount, total };
}
