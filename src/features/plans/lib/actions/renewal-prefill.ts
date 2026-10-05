import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import { resolveRenewalSubject } from "../renewal-subject";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import { toLocalPhone } from "@/lib/plans/local-phone";
import { isActiveTrainee, renewalLocks, usableAccount, type RenewalLocks } from "@/lib/plans/bound-renewal";
import { alreadyRenewedUntil } from "@/lib/plans/plan-queue";
import { israelToday } from "@/lib/utils/tasks";
import { loadPlanQueues } from "../queries";
import type { EnrollmentAgreement, PlanProduct } from "@/types/plans";

export interface RenewalPrefill {
  /** Null when the old product cannot be bought again: the catalog opens instead. */
  productId: string | null;
  prefill: Partial<EnrollmentInput>;
  /** Child fields that come from the account and show read-only. */
  locks: RenewalLocks;
  /** The last day already paid for when a Plan is waiting in the queue: warn, never block. */
  renewedUntil: string | null;
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
  const subject = await resolveRenewalSubject(db, verified);
  if (!subject || "error" in subject) return null;
  const { profileId } = subject;

  const [{ data: product }, { data: agreement }, { data: profile }, queues] = (await Promise.all([
    subject.productId
      ? typedFrom(db, "plan_products").select("id, is_active, once_per_trainee").eq("id", subject.productId).maybeSingle()
      : Promise.resolve({ data: null }),
    typedFrom(db, "enrollment_agreements")
      .select("*")
      .eq("profile_id", profileId)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("profiles")
      .select("phone, full_name, birthdate, guardian_name, guardian_phone, role, deleted_at")
      .eq("id", profileId)
      .maybeSingle(),
    loadPlanQueues(db, [profileId], israelToday()),
  ])) as [
    { data: Pick<PlanProduct, "id" | "is_active" | "once_per_trainee"> | null },
    { data: EnrollmentAgreement | null },
    {
      data: {
        phone: string | null;
        full_name: string | null;
        birthdate: string | null;
        guardian_name: string | null;
        guardian_phone: string | null;
        role: string;
        deleted_at: string | null;
      } | null;
    },
    Awaited<ReturnType<typeof loadPlanQueues>>,
  ];
  // Checkout binds only an active trainee; the form must not lock fields the
  // server will not honour.
  if (!profile || !isActiveTrainee(profile)) return null;
  const productId = product && product.is_active && !product.once_per_trainee ? product.id : null;

  const usable = usableAccount({ fullName: profile.full_name, birthdate: profile.birthdate, phone: profile.phone });
  const prefill: Partial<EnrollmentInput> = {
    parentName: agreement?.parent_name ?? profile.guardian_name ?? "",
    payerPhone: toLocalPhone(agreement?.parent_phone ?? profile.guardian_phone),
    loginPhone: toLocalPhone(usable.phone),
    email: agreement?.parent_email ?? "",
    // The account wins over the last agreement: the purchase lands on it.
    childName: usable.fullName ?? agreement?.child_name ?? "",
    childBirthdate: usable.birthdate ?? agreement?.child_birthdate ?? "",
    medicalNotes: agreement?.medical_notes ?? "",
    emergencyContactName: agreement?.emergency_contact_name ?? "",
    emergencyContactPhone: toLocalPhone(agreement?.emergency_contact_phone),
  };

  const queue = queues.get(profileId)?.queue;
  const renewedUntil = queue ? alreadyRenewedUntil(queue) : null;

  return { productId, prefill, locks: renewalLocks(usable), renewedUntil };
}
