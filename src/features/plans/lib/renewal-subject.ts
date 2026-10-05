import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import type { verifyRenewalToken } from "@/lib/plans/renewal-token";

/** Who a purchase link is for: the trainee, and the Plan a renewal link named (its product is offered again). */
export interface RenewalSubject {
  profileId: string;
  planId: string | null;
  productId: string | null;
}

/**
 * A verified link's trainee, whichever way it was signed: a renewal link
 * names a Plan, the in-app link names the trainee. Null when the Plan is
 * gone; an error when the lookup itself failed.
 */
export async function resolveRenewalSubject(
  db: SupabaseClient,
  verified: NonNullable<ReturnType<typeof verifyRenewalToken>>,
): Promise<RenewalSubject | { error: string } | null> {
  if ("profileId" in verified) return { profileId: verified.profileId, planId: null, productId: null };
  const { data: plan, error } = (await typedFrom(db, "trainee_plans")
    .select("id, profile_id, product_id")
    .eq("id", verified.planId)
    .maybeSingle()) as { data: { id: string; profile_id: string; product_id: string } | null; error: { message: string } | null };
  if (error) {
    console.error("[renewal] plan lookup failed:", error.message);
    return { error: "לא הצלחנו לאמת את הקישור. נסו שוב בעוד רגע." };
  }
  return plan ? { profileId: plan.profile_id, planId: plan.id, productId: plan.product_id } : null;
}
