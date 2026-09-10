import type { BranchOption } from "@/types/branches";
import { NO_BRANCH_LABEL_HE } from "@/types/branches";

export const BRANCH_FILTER_ALL = "all";
export const BRANCH_FILTER_NONE = "none";

export interface BranchFilterOption {
  value: string;
  label: string;
}

export function buildBranchFilterOptions(
  branches: readonly BranchOption[],
): BranchFilterOption[] {
  return [
    { value: BRANCH_FILTER_ALL, label: "כל הסניפים" },
    ...branches.map((b) => ({ value: b.id, label: b.nameHe })),
    { value: BRANCH_FILTER_NONE, label: NO_BRANCH_LABEL_HE },
  ];
}

export function matchesBranchFilter(
  branchIds: readonly string[],
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === BRANCH_FILTER_ALL) return true;
  if (filter === BRANCH_FILTER_NONE) return branchIds.length === 0;
  return branchIds.includes(filter);
}
