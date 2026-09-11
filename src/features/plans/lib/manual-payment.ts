import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import { fulfillFromInput } from "@/features/enrollment/lib/fulfillment";
import { issueOrderInvoice } from "@/features/enrollment/lib/invoice";
import { agreementLink, notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import { TERMS_VERSION } from "../../../../content/terms-kiryat-ata";
import {
  PAYMENT_METHOD_LABELS_HE,
  type EnrollmentAgreement,
  type Order,
  type PlanProduct,
  type TraineePlan,
} from "@/types/plans";

export interface ManualPaymentInput {
  product: PlanProduct;
  trainee: {
    profileId: string | null;
    /** E.164; the child's WhatsApp, which is the login. */
    loginPhone: string;
    childName: string;
    childBirthdate: string | null;
  };
  parent: { name: string; phone: string; email: string | null };
  health: {
    medicalNotes: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  paymentMethod: "cash" | "transfer" | "bit";
  reference: string | null;
  /** Null lets fulfillment chain after a running plan (existing trainee). */
  startsOn: string | null;
  sendWhatsApp: boolean;
  actor: { id: string; name: string | null };
}

export interface ManualPaymentResult {
  ok: true;
  orderId: string;
  profileId: string;
  planId: string;
  endsOn: string;
  invoice: { url: string | null; error: string | null; skipped: boolean };
  whatsapp: { sentTo: string | null; error: string | null; skipped: boolean };
  agreementUrl: string;
}

const DUPLICATE_WINDOW_MINUTES = 10;

/** A manual plan for the same trainee and product a few minutes ago: the dialogs ask before repeating. */
export async function findRecentDuplicate(
  db: SupabaseClient,
  profileId: string,
  productId: string,
): Promise<{ minutesAgo: number } | null> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data } = (await typedFrom(db, "orders")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("product_id", productId)
    .eq("payment_provider", "manual")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { created_at: string } | null };
  if (!data) return null;
  return { minutesAgo: Math.max(0, Math.round((Date.now() - new Date(data.created_at).getTime()) / 60000)) };
}

/**
 * A payment taken by hand: a paid order, an agreement waiting for the
 * parent's signature, the account and plan through the same fulfillment as
 * an online sale, the Morning receipt, and the WhatsApp with the signing
 * link. Each side effect after the plan is best-effort and reported back so
 * the staff member sees what the parent received.
 */
export async function recordManualPayment(
  db: SupabaseClient,
  input: ManualPaymentInput,
): Promise<ManualPaymentResult | { ok: false; error: string }> {
  const { product } = input;

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: "manual",
      payment_method: input.paymentMethod,
      reference: input.reference,
      received_by: input.actor.id,
      amount_ils: product.price_ils,
      parent_name: input.parent.name,
      payer_phone: input.parent.phone,
      login_phone: input.trainee.loginPhone,
      child_name: input.trainee.childName,
      child_birthdate: input.trainee.childBirthdate,
      email: input.parent.email,
      profile_id: input.trainee.profileId,
    })
    .select("*")
    .single()) as { data: Order | null; error: { message: string } | null };
  if (orderError || !order) {
    console.error("[manual-payment] order insert failed:", orderError?.message);
    return { ok: false, error: "שגיאה ביצירת ההזמנה" };
  }

  // Unsigned: the parent completes and signs it from the WhatsApp link.
  const { data: agreement, error: agreementError } = (await typedFrom(db, "enrollment_agreements")
    .insert({
      order_id: order.id,
      profile_id: input.trainee.profileId,
      agreement_version: TERMS_VERSION,
      parent_name: input.parent.name,
      parent_id_number: "",
      parent_phone: input.parent.phone,
      parent_email: input.parent.email,
      child_name: input.trainee.childName,
      child_birthdate: input.trainee.childBirthdate,
      medical_notes: input.health.medicalNotes,
      plan_name: product.name_he,
      plan_price_ils: product.price_ils,
      plan_start_on: input.startsOn ?? israelToday(),
      payment_method: PAYMENT_METHOD_LABELS_HE[input.paymentMethod],
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
  if (agreementError || !agreement) {
    console.error("[manual-payment] agreement insert failed:", agreementError?.message);
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { ok: false, error: "שגיאה בשמירת ההסכם" };
  }

  const fulfilled = await fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: input.actor.id,
  });
  if (!fulfilled.ok) return { ok: false, error: `ההזמנה נשמרה אך היצירה נכשלה: ${fulfilled.error}` };

  // A chosen start date (new trainee) overrides the chaining default.
  const today = israelToday();
  const note = `${PAYMENT_METHOD_LABELS_HE[input.paymentMethod]}${input.reference ? ` ${input.reference}` : ""}`;
  const patch =
    input.startsOn && input.startsOn !== today
      ? { starts_on: input.startsOn, ends_on: addDays(input.startsOn, product.duration_days - 1), note }
      : { note };
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .update(patch)
    .eq("id", fulfilled.planId)
    .select("ends_on")
    .single()) as { data: Pick<TraineePlan, "ends_on"> | null };

  await db.from("activity_logs").insert({
    user_id: fulfilled.profileId,
    action: "plan_granted",
    actor_id: input.actor.id,
    actor_name: input.actor.name ?? "צוות",
    metadata: {
      orderId: order.id,
      productId: product.id,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      amountIls: Number(product.price_ils),
    },
  });

  const invoice = await issueOrderInvoice(db, order.id, input.actor);
  const whatsapp = input.sendWhatsApp
    ? await notifyOrderFulfilled(db, order.id)
    : null;

  return {
    ok: true,
    orderId: order.id,
    profileId: fulfilled.profileId,
    planId: fulfilled.planId,
    endsOn: plan?.ends_on ?? "",
    invoice: invoice.ok
      ? { url: invoice.url, error: null, skipped: false }
      : { url: null, error: invoice.skipped ? null : invoice.error, skipped: invoice.skipped },
    whatsapp: whatsapp
      ? {
          sentTo: whatsapp.confirmed?.success ? whatsapp.sentTo : null,
          error: whatsapp.confirmed && !whatsapp.confirmed.success ? (whatsapp.confirmed.error ?? "שליחה נכשלה") : null,
          skipped: false,
        }
      : { sentTo: null, error: null, skipped: true },
    agreementUrl: agreementLink(agreement.id),
  };
}
