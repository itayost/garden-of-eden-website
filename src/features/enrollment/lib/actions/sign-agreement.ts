"use server";

import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyAgreementToken } from "@/lib/plans/agreement-token";
import { planTokenSecret } from "@/lib/plans/token-secret";
import { signAgreementSchema, type SignAgreementInput } from "@/lib/validations/agreement-sign";
import { TERMS_VERSION } from "../../../../../content/terms-kiryat-ata";
import type { EnrollmentAgreement } from "@/types/plans";

type SignResult = { ok: true } | { error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * The parent completes and signs an agreement a staff member opened for
 * them. Unauthenticated: the HMAC in the WhatsApp link is the credential.
 * Signing is one-way; a signed row returns ok without changes. Health and
 * consent details flow to the profile where the profile has none yet.
 */
export async function signAgreementAction(input: SignAgreementInput): Promise<SignResult> {
  const limit = await checkRateLimit(`ip:${await clientIp()}`, "checkout");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." };

  const parsed = signAgreementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;
  if (!verifyAgreementToken(data.agreementId, data.token, planTokenSecret())) {
    return { error: "הקישור אינו תקין" };
  }

  const db = createAdminClient();
  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .select("id, signed_at, profile_id")
    .eq("id", data.agreementId)
    .maybeSingle()) as { data: Pick<EnrollmentAgreement, "id" | "signed_at" | "profile_id"> | null };
  if (!agreement) return { error: "ההסכם לא נמצא" };
  if (agreement.signed_at) return { ok: true };

  const { data: signed, error } = (await typedFrom(db, "enrollment_agreements")
    .update({
      agreement_version: TERMS_VERSION,
      parent_name: data.parentName,
      parent_id_number: data.parentIdNumber,
      parent_email: data.parentEmail,
      child_birthdate: data.childBirthdate,
      medical_notes: data.medicalNotes,
      emergency_contact_name: data.emergencyContactName,
      emergency_contact_phone: data.emergencyContactPhone,
      declares_healthy: data.declaresHealthy,
      accepts_terms: data.acceptsTerms,
      authorizes_payment: data.authorizesPayment,
      photo_consent: data.photoConsent,
      signature_name: data.signatureName,
      signed_at: new Date().toISOString(),
      signed_ip: await clientIp(),
    })
    .eq("id", data.agreementId)
    .is("signed_at", null)
    .select("id")) as { data: { id: string }[] | null; error: { message: string } | null };
  if (error) {
    console.error(`[sign-agreement] update failed for ${data.agreementId}:`, error.message);
    return { error: "שגיאה בשמירת החתימה. נסו שוב." };
  }
  if (!signed || signed.length === 0) return { ok: true };

  if (agreement.profile_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("birthdate, guardian_name, medical_notes, emergency_contact_name, emergency_contact_phone, photo_consent")
      .eq("id", agreement.profile_id)
      .maybeSingle();
    if (profile) {
      // The parent's answers fill gaps only; staff corrections stay.
      await db
        .from("profiles")
        .update({
          birthdate: profile.birthdate ?? data.childBirthdate,
          guardian_name: profile.guardian_name ?? data.parentName,
          medical_notes: profile.medical_notes ?? data.medicalNotes,
          emergency_contact_name: profile.emergency_contact_name ?? data.emergencyContactName,
          emergency_contact_phone: profile.emergency_contact_phone ?? data.emergencyContactPhone,
          photo_consent: profile.photo_consent ?? data.photoConsent,
        })
        .eq("id", agreement.profile_id);
    }
    if (data.parentEmail) {
      // Morning emails receipts to the order's address; keep it for the next one.
      await typedFrom(db, "orders")
        .update({ email: data.parentEmail })
        .eq("profile_id", agreement.profile_id)
        .is("email", null);
    }
  }
  return { ok: true };
}
