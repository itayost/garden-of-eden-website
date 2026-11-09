import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import type { EnrollmentAgreement } from "@/types/plans";
import { termsVersionOf } from "@/features/enrollment/lib/branch-terms";

export interface UnsignedAgreementInput {
  orderId: string;
  /** The branch the Plan is sold at: the agreement records that branch's terms. */
  branchId: string;
  profileId: string | null;
  parent: { name: string; phone: string; email: string | null };
  child: { name: string; birthdate: string | null };
  health: {
    medicalNotes: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  planName: string;
  /** What the parent pays: the receipt's amount, a Discount included. */
  priceIls: number;
  startsOn: string;
  paymentLabel: string;
}

/**
 * An agreement a staff member opens for the parent to complete and sign from
 * the WhatsApp link (/join/agreement/[id]?t=): a sale taken by hand, or a
 * Payment link the parent then pays by card.
 */
export async function insertUnsignedAgreement(
  db: SupabaseClient,
  input: UnsignedAgreementInput,
): Promise<EnrollmentAgreement | null> {
  let version: string;
  try {
    version = await termsVersionOf(db, input.branchId);
  } catch (error) {
    console.error("[agreement] terms version lookup failed:", error);
    return null;
  }
  const { data, error } = (await typedFrom(db, "enrollment_agreements")
    .insert({
      order_id: input.orderId,
      profile_id: input.profileId,
      agreement_version: version,
      parent_name: input.parent.name,
      parent_id_number: "",
      parent_phone: input.parent.phone,
      parent_email: input.parent.email,
      child_name: input.child.name,
      child_birthdate: input.child.birthdate,
      medical_notes: input.health.medicalNotes,
      plan_name: input.planName,
      plan_price_ils: input.priceIls,
      plan_start_on: input.startsOn,
      payment_method: input.paymentLabel,
      emergency_contact_name: input.health.emergencyContactName ?? "",
      emergency_contact_phone: input.health.emergencyContactPhone ?? "",
      declares_healthy: false,
      accepts_terms: false,
      authorizes_payment: false,
      photo_consent: false,
      signature_name: "",
      signed_at: null,
    })
    .select("*")
    .single()) as { data: EnrollmentAgreement | null; error: { message: string } | null };
  if (error) console.error("[agreement] unsigned insert failed:", error.message);
  return data;
}
