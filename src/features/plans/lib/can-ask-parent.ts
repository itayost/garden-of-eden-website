import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { KIRYAT_ATA_BRANCH_NAME } from "@/features/enrollment/lib/catalog";

/**
 * Whether a trainee may ask the parent to buy a Plan from the app: online
 * payments are open and one of the trainee's branches sells in the /join
 * catalog. The message is a WhatsApp template (Meta approves them fast, so
 * nothing waits on it; owner, 2026-10-06).
 * branchIds: the trainee's branches when the caller already has them.
 */
export async function canAskParentToBuy(
  db: SupabaseClient,
  profileId: string,
  branchIds?: readonly string[],
): Promise<boolean> {
  if (!onlinePaymentsOpen()) return false;
  const ids = branchIds ?? (await loadBranchIdsByProfile(db, [profileId])).get(profileId) ?? [];
  if (ids.length === 0) return false;
  const { count } = await db
    .from("plan_products")
    .select("id, branch:branches!inner(name_he)", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("branch.name_he", KIRYAT_ATA_BRANCH_NAME)
    .in("branch_id", [...ids]);
  return (count ?? 0) > 0;
}
