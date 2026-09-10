import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isTraineeInScope,
  OUT_OF_SCOPE_TRAINEE_ERROR,
} from "@/features/branches/lib/memberships";

/**
 * The Hebrew error when the caller may not act on this trainee, or null.
 * Callers are already gated by verifyAdminOrTrainer; admins always pass.
 */
export async function assertTraineeInScope(traineeId: string): Promise<string | null> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return scopeResult.error;
  const inScope = await isTraineeInScope(
    createAdminClient(),
    scopeResult.data.scope,
    traineeId,
  );
  return inScope ? null : OUT_OF_SCOPE_TRAINEE_ERROR;
}
