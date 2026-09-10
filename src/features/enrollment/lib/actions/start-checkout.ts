"use server";

import { phoneVariants } from "@/lib/plans/phone-variants";
import { planTokenSecret } from "@/lib/plans/token-secret";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import { israelToday } from "@/lib/utils/tasks";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations/enrollment";
import { TERMS_VERSION } from "../../../../../content/terms-kiryat-ata";
import { loadProductById } from "../catalog";

type StartResult = { error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Validates the agreement, records a pending order and the signed agreement,
 * and sends the parent to the site's own card page for that order.
 *
 * Unauthenticated by design: the parent has no account yet. No money moves
 * here, only an order row, so the checkout limiter (5 per 10 minutes per IP
 * and per login phone, fails open when Redis is missing) is the abuse guard;
 * the card charge has the strict one.
 */
export async function startCheckoutAction(input: EnrollmentInput): Promise<StartResult> {
  const ip = await clientIp();
  const limit = await checkRateLimit(`ip:${ip}`, "checkout");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." };

  const validated = enrollmentSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }
  const data = validated.data;

  const phoneLimit = await checkRateLimit(`phone:${data.loginPhone}`, "checkout");
  waitUntil(phoneLimit.pending);
  if (phoneLimit.rateLimited) return { error: "יותר מדי ניסיונות למספר הזה. נסו שוב בעוד כמה דקות." };

  const product = await loadProductById(data.productId);
  if (!product || !product.is_active) return { error: "המסלול אינו זמין" };

  const db = createAdminClient();

  // The login phone may already be a trainee (renewal, second plan) but never
  // a staff account: fulfillment would otherwise rewrite it.
  const { data: owner } = await db
    .from("profiles")
    .select("role")
    .in("phone", phoneVariants(data.loginPhone))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (owner && owner.role !== "trainee") {
    return { error: "מספר הטלפון להתחברות שייך לחשבון צוות. השתמשו במספר אחר." };
  }

  // A renewal token names the plan being renewed. It only counts when the
  // plan belongs to the phone on the form; otherwise, or when invalid, this
  // is a fresh purchase.
  let renewalOfPlanId: string | null = null;
  if (data.renewalToken) {
    const secret = planTokenSecret();
    const verified = verifyRenewalToken(data.renewalToken, secret, Math.floor(Date.now() / 1000));
    if (verified) {
      const { data: renewed } = (await typedFrom(db, "trainee_plans")
        .select("id, profile:profiles!inner(phone)")
        .eq("id", verified.planId)
        .maybeSingle()) as { data: { id: string; profile: { phone: string | null } | null } | null };
      const phone = renewed?.profile?.phone;
      if (phone && phoneVariants(data.loginPhone).includes(phone)) renewalOfPlanId = renewed.id;
    }
  }

  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .eq("login_phone", data.loginPhone)
      .eq("status", "paid")
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות היא לשחקן חדש בלבד. בחרו מסלול אחר." };
    }
  }

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      amount_ils: product.price_ils,
      parent_name: data.parentName,
      payer_phone: data.payerPhone,
      login_phone: data.loginPhone,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      email: data.email,
      renewal_of_plan_id: renewalOfPlanId,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (orderError || !order) {
    console.error("startCheckout order insert error:", orderError);
    return { error: "שגיאה בשמירת ההזמנה" };
  }

  const { error: agreementError } = await typedFrom(db, "enrollment_agreements").insert({
    order_id: order.id,
    agreement_version: TERMS_VERSION,
    parent_name: data.parentName,
    parent_id_number: data.parentIdNumber.replace(/\s+/g, ""),
    parent_phone: data.payerPhone,
    parent_email: data.email,
    child_name: data.childName,
    child_birthdate: data.childBirthdate,
    medical_notes: data.medicalNotes,
    plan_name: product.name_he,
    plan_price_ils: product.price_ils,
    plan_start_on: israelToday(),
    payment_method: "כרטיס אשראי",
    emergency_contact_name: data.emergencyContactName,
    emergency_contact_phone: data.emergencyContactPhone,
    declares_healthy: data.declaresHealthy,
    accepts_terms: data.acceptsTerms,
    authorizes_payment: data.authorizesPayment,
    photo_consent: data.photoConsent,
    signature_name: data.signatureName,
    signed_ip: ip,
  });

  if (agreementError) {
    console.error("startCheckout agreement insert error:", agreementError);
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "שגיאה בשמירת ההסכם" };
  }

  redirect(`/join/pay/${order.id}`);
}
