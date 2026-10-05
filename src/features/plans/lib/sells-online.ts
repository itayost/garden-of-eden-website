import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";

/** Whether one of the trainee's branches sells Plans online (an active catalog product). */
export async function sellsOnline(db: SupabaseClient, profileId: string): Promise<boolean> {
  const branchIds = (await loadBranchIdsByProfile(db, [profileId])).get(profileId) ?? [];
  if (branchIds.length === 0) return false;
  const { count } = (await typedFrom(db, "plan_products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("branch_id", branchIds)) as { count: number | null };
  return (count ?? 0) > 0;
}
