/**
 * Who a staff member may see, expressed as a set of branches.
 *
 * The rule lives here and only here. Every trainer-facing list applies it in
 * its server query, so the lists cannot drift from each other.
 */
export type BranchScope =
  | { kind: "all" }
  | { kind: "branches"; ids: readonly string[] };

export const ALL_BRANCHES_SCOPE: BranchScope = { kind: "all" };

/**
 * Admins see everything. A trainer sees their branches. A trainer with no
 * branch assigned yet also sees everything: failing open matches the access
 * tier convention, and an unassigned trainer staring at an empty academy
 * during rollout would be worse than a trainer seeing one extra branch.
 */
export function resolveBranchScope(
  role: string,
  memberBranchIds: readonly string[],
): BranchScope {
  if (role === "admin") return ALL_BRANCHES_SCOPE;
  if (memberBranchIds.length === 0) return ALL_BRANCHES_SCOPE;
  return { kind: "branches", ids: [...memberBranchIds] };
}

/** A user is in scope when they share at least one branch with the scope. */
export function isInBranchScope(
  scope: BranchScope,
  memberBranchIds: readonly string[],
): boolean {
  if (scope.kind === "all") return true;
  return memberBranchIds.some((id) => scope.ids.includes(id));
}
