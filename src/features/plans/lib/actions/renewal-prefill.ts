import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import { toLocalPhone } from "@/lib/plans/local-phone";
import type { EnrollmentAgreement, PlanProduct, TraineePlan } from "@/types/plans";

export interface RenewalPrefill {
  /** Null when the old product cannot be bought again: the catalog opens instead. */
  productId: string | null;
  planId: string;
  prefill: Partial<EnrollmentInput>;
}

/**
 * A valid token opens the form for the same product with the last agreement's
 * details filled in. The declarations, the signature, and the parent's ID
 * number are never prefilled: the agreement is per purchase, and the link
 * travels over WhatsApp.
 */
export async function loadRenewalPrefill(token: string): Promise<RenewalPrefill | null> {
  const secret = planTokenSecret();
  const verified = verifyRenewalToken(token, secret, Math.floor(Date.now() / 1000));
  if (!verified) return null;

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("id, product_id, profile_id, order_id")
    .eq("id", verified.planId)
    .maybeSingle()) as {
    data: Pick<TraineePlan, "id" | "product_id" | "profile_id" | "order_id"> | null;
  };
  if (!plan) return null;

  const { data: product } = (await typedFrom(db, "plan_products")
    .select("id, is_active, once_per_trainee")
    .eq("id", plan.product_id)
    .maybeSingle()) as { data: Pick<PlanProduct, "id" | "is_active" | "once_per_trainee"> | null };
  const productId = product && product.is_active && !product.once_per_trainee ? product.id : null;

  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .select("*")
    .eq("profile_id", plan.profile_id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: EnrollmentAgreement | null };

  const { data: profile } = await db
    .from("profiles")
    .select("phone, full_name, birthdate, guardian_name, guardian_phone")
    .eq("id", plan.profile_id)
    .maybeSingle();

  const prefill: Partial<EnrollmentInput> = {
    parentName: agreement?.parent_name ?? profile?.guardian_name ?? "",
    payerPhone: toLocalPhone(agreement?.parent_phone ?? profile?.guardian_phone),
    loginPhone: toLocalPhone(profile?.phone),
    email: agreement?.parent_email ?? "",
    childName: agreement?.child_name ?? profile?.full_name ?? "",
    childBirthdate: agreement?.child_birthdate ?? profile?.birthdate ?? "",
    medicalNotes: agreement?.medical_notes ?? "",
    emergencyContactName: agreement?.emergency_contact_name ?? "",
    emergencyContactPhone: toLocalPhone(agreement?.emergency_contact_phone),
  };

  return { productId, planId: plan.id, prefill };
}
