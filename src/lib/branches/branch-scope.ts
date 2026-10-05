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
 * Admins see everything. Every other member of staff sees only the branches
 * they are assigned to, so one with none sees nobody until an Admin assigns
 * a branch.
 */
export function resolveBranchScope(
  role: string,
  memberBranchIds: readonly string[],
): BranchScope {
  if (role === "admin") return ALL_BRANCHES_SCOPE;
  return { kind: "branches", ids: [...memberBranchIds] };
}

/**
 * Whether a member of staff may act as an Admin for something in these
 * branches: an Admin always, a Trainer only for a branch they manage (a
 * Branch manager, ADR-0009).
 */
export function canManageBranches(
  role: string,
  managedBranchIds: readonly string[],
  targetBranchIds: readonly string[],
): boolean {
  if (role === "admin") return true;
  if (role !== "trainer") return false;
  return targetBranchIds.some((id) => managedBranchIds.includes(id));
}

/** A user is in scope when they share at least one branch with the scope. */
export function isInBranchScope(
  scope: BranchScope,
  memberBranchIds: readonly string[],
): boolean {
  if (scope.kind === "all") return true;
  return memberBranchIds.some((id) => scope.ids.includes(id));
}
