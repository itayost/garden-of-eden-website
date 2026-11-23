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
  /** מחיר אימון בודד; null means the 10-Card per-session rate. */
  single_session_price_ils: number | null;
  created_at: string;
  updated_at: string;
}

/** The subset pickers and badges need. */
export interface BranchOption {
  id: string;
  nameHe: string;
}

/**
 * The profile columns the users list, its table and its CSV export read. The
 * page selects only these, so the whole academy's profiles are not sent to the
 * browser with every column. Add a column here when a list surface needs it.
 */
export const USER_LIST_COLUMNS =
  "id, full_name, phone, role, is_active, position, avatar_url, deleted_at, created_at";

export type UserListProfile = Pick<
  Profile,
  | "id"
  | "full_name"
  | "phone"
  | "role"
  | "is_active"
  | "position"
  | "avatar_url"
  | "deleted_at"
  | "created_at"
>;

/** A users-list profile with its memberships resolved, for admin tables and exports. */
export type ProfileWithBranches = UserListProfile & {
  branchIds: string[];
  branchNames: string[];
  /** Plan status and medical flag; absent for staff and for trainees with neither. */
  planBadge?: StaffPlanBadge;
};

export const NO_BRANCH_LABEL_HE = "ללא סניף";

export function toBranchOption(branch: Branch): BranchOption {
  return { id: branch.id, nameHe: branch.name_he };
}
