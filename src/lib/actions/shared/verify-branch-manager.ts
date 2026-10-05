import "server-only";

import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { canManageBranches } from "@/lib/branches/branch-scope";

export const BRANCH_MANAGER_REQUIRED = "נדרשת הרשאת מנהל או מנהל הסניף";

/**
 * An Admin, or a Branch manager of one of these branches (ADR-0009). The one
 * check for admin powers over a plan, an order or a trainee, given the
 * branches that thing belongs to. Returns an error message, or null.
 */
export async function verifyAdminOrBranchManager(
  branchIds: readonly string[],
): Promise<string | null> {
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) return error;
  if (profile!.role === "admin") return null;

  const scope = await getBranchScopeAction();
  if ("error" in scope) return scope.error;
  return canManageBranches(profile!.role, scope.data.managedBranchIds, branchIds)
    ? null
    : BRANCH_MANAGER_REQUIRED;
}
