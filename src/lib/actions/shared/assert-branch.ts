import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";

/**
 * A mutation may write to a branch only when it is active and, for trainers,
 * one of theirs. Callers are already gated by a verify call.
 */
export async function assertBranchWritable(
  branchId: string,
): Promise<{ error: string | null }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };

  if (!isInBranchScope(scopeResult.data.scope, [branchId])) {
    return { error: "הסניף אינו בסניפים שלך" };
  }

  const { data, error } = (await typedFrom(createAdminClient(), "branches")
    .select("id")
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle()) as { data: { id: string } | null; error: { message: string } | null };

  if (error) {
    console.error("assertBranchWritable error:", error);
    return { error: "שגיאה באימות הסניף" };
  }
  if (!data) return { error: "הסניף לא נמצא או אינו פעיל" };
  return { error: null };
}
