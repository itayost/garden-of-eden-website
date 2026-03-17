import type { SectionCompleteness } from "@/types/assessment";

/**
 * Returns true when a section is considered "done".
 * Mental section (key === 'mental'): any completed note counts (completed > 0).
 * Quantitative sections: all fields must be filled (completed === total).
 */
export function isSectionDone(section: SectionCompleteness): boolean {
  if (section.key === "mental") return section.completed > 0;
  return section.completed === section.total;
}
