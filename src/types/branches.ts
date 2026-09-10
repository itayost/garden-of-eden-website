import type { Profile } from "@/types/database";
import type { StaffPlanBadge } from "@/types/plans";

/** One physical academy location. Mirrors the branches table. */
export interface Branch {
  id: string;
  name_he: string;
  arbox_location_name: string | null;
  is_active: boolean;
  order_index: number;
  manager_phone: string | null;
  created_at: string;
  updated_at: string;
}

/** The subset pickers and badges need. */
export interface BranchOption {
  id: string;
  nameHe: string;
}

/** A profile row with its memberships resolved, for admin tables and exports. */
export type ProfileWithBranches = Profile & {
  branchIds: string[];
  branchNames: string[];
  /** Plan status and medical flag; absent for staff and for trainees with neither. */
  planBadge?: StaffPlanBadge;
};

export const NO_BRANCH_LABEL_HE = "ללא סניף";

export function toBranchOption(branch: Branch): BranchOption {
  return { id: branch.id, nameHe: branch.name_he };
}
