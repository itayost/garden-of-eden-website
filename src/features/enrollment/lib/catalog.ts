import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import type { PlanProduct } from "@/types/plans";

export const KIRYAT_ATA_BRANCH_NAME = "קריית אתא";

/**
 * The active קריית אתא products, in display order. Empty on any failure.
 *
 * Admin client on a public page: /join renders on the server with no session.
 * The catalog policy allows anon reads too, so switching to the anon client
 * later is a one-line change.
 */
export async function loadKiryatAtaCatalog(): Promise<PlanProduct[]> {
  const db = createAdminClient();
  const { data: branch } = (await typedFrom(db, "branches")
    .select("id")
    .eq("name_he", KIRYAT_ATA_BRANCH_NAME)
    .maybeSingle()) as { data: { id: string } | null };
  if (!branch) return [];

  const { data, error } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("branch_id", branch.id)
    .eq("is_active", true)
    .order("order_index")) as {
    data: PlanProduct[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("loadKiryatAtaCatalog error:", error);
    return [];
  }
  return (data ?? []).map((row) => ({ ...row, price_ils: Number(row.price_ils) }));
}

export async function loadProductById(productId: string): Promise<PlanProduct | null> {
  const { data } = (await typedFrom(createAdminClient(), "plan_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle()) as { data: PlanProduct | null };
  return data ? { ...data, price_ils: Number(data.price_ils) } : null;
}
