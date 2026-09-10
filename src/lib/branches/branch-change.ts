import type { FieldChange } from "@/types/activity-log";

function joinNames(names: readonly string[]): string | null {
  return names.length === 0 ? null : [...names].sort().join(", ");
}

/**
 * The activity-log entry for a branch edit, or null when nothing moved.
 * Compares as sets so reordering is not a change.
 */
export function branchFieldChange(
  originalNames: readonly string[],
  updatedNames: readonly string[],
): FieldChange | null {
  const before = joinNames(originalNames);
  const after = joinNames(updatedNames);
  if (before === after) return null;
  return { field: "branches", old_value: before, new_value: after };
}
