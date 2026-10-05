import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";

/**
 * Whether a trainee may ask the parent to buy a Plan from the app: the
 * WhatsApp template is approved (until then the request is hidden, so the
 * child never holds the parent's link; owner, 2026-10-06), online payments
 * are open, and one of the trainee's branches is in the catalog /join shows.
 */
export async function canAskParentToBuy(db: SupabaseClient, profileId: string): Promise<boolean> {
  if (!process.env.WHATSAPP_PURCHASE_REQUEST_TEMPLATE_NAME?.trim() || !onlinePaymentsOpen()) return false;
  const [memberships, catalog] = await Promise.all([loadBranchIdsByProfile(db, [profileId]), loadKiryatAtaCatalog()]);
  const branchIds = memberships.get(profileId) ?? [];
  return catalog.some((product) => branchIds.includes(product.branch_id));
}
