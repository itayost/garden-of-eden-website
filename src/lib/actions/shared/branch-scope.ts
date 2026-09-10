"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import {
  ALL_BRANCHES_SCOPE,
  resolveBranchScope,
  type BranchScope,
} from "@/lib/branches/branch-scope";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";

export interface BranchScopeData {
  scope: BranchScope;
  /** The caller's own memberships, whatever their role. */
  memberBranchIds: string[];
}

type BranchScopeResult = { success: true; data: BranchScopeData } | { error: string };

/**
 * The caller's branch scope, memoized per request.
 *
 * Reads the caller's own profile_branches rows through the user client, which
 * RLS allows. Admins always resolve to "all"; their membership list only
 * matters for the schedule switcher's default.
 */
export const getBranchScopeAction = cache(async (): Promise<BranchScopeResult> => {
  const { error, user, profile } = await verifyAdminOrTrainer();
  if (error) return { error };

  // Admins skip the read: their scope is "all" whatever they belong to.
  if (profile!.role === "admin") {
    return { success: true, data: { scope: ALL_BRANCHES_SCOPE, memberBranchIds: [] } };
  }

  const supabase = await createClient();
  const { data, error: readError } = (await typedFrom(supabase, "profile_branches")
    .select("branch_id")
    .eq("profile_id", user!.id)) as {
    data: { branch_id: string }[] | null;
    error: { message: string } | null;
  };

  if (readError) {
    console.error("getBranchScopeAction read error:", readError);
    return { error: "שגיאה בטעינת הסניפים" };
  }

  const memberBranchIds = (data ?? []).map((row) => row.branch_id);
  const scope = resolveBranchScope(profile!.role, memberBranchIds);

  return { success: true, data: { scope, memberBranchIds } };
});
