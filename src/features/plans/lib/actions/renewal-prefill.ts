import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import type { EnrollmentAgreement, TraineePlan } from "@/types/plans";

export interface RenewalPrefill {
  productId: string;
  planId: string;
  prefill: Partial<EnrollmentInput>;
}

function localPhone(e164: string): string {
  return e164.startsWith("+972") ? `0${e164.slice(4)}` : e164;
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
    payerPhone: localPhone(agreement?.parent_phone ?? profile?.guardian_phone ?? ""),
    loginPhone: localPhone(profile?.phone ?? ""),
    email: agreement?.parent_email ?? "",
    childName: agreement?.child_name ?? profile?.full_name ?? "",
    childBirthdate: agreement?.child_birthdate ?? profile?.birthdate ?? "",
    medicalNotes: agreement?.medical_notes ?? "",
    emergencyContactName: agreement?.emergency_contact_name ?? "",
    emergencyContactPhone: localPhone(agreement?.emergency_contact_phone ?? ""),
  };

  return { productId: plan.product_id, planId: plan.id, prefill };
}
