import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import { fulfillFromInput } from "@/features/enrollment/lib/fulfillment";
import { issueOrderInvoice } from "@/features/enrollment/lib/invoice";
import { agreementLink, notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import { insertUnsignedAgreement } from "./unsigned-agreement";
import type { Discount } from "@/lib/plans/discount";
import { staffOrderColumns } from "./staff-order";
import {
  PAYMENT_METHOD_LABELS_HE,
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
  /** A sale below list price, already allowed by the action; null at list price. */
  discount: Discount | null;
  actor: { id: string; name: string | null };
}

export interface ManualPaymentResult {
  ok: true;
  orderId: string;
  agreementId: string;
  profileId: string;
  planId: string;
  endsOn: string;
  invoice: { url: string | null; error: string | null; skipped: boolean };
  /** shareUrl: the template waits for Meta, so staff open the chat from their own WhatsApp. */
  whatsapp: { sentTo: string | null; error: string | null; skipped: boolean; shareUrl?: string | null };
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
  // Cash has no reference; a leftover from a switched method must not stick.
  const reference = input.paymentMethod === "cash" ? null : input.reference;
  // What was paid: the receipt, the agreement and any refund use it.
  const sale = staffOrderColumns(product, input.discount, input.actor.id, {
    profileId: input.trainee.profileId,
    loginPhone: input.trainee.loginPhone,
    child: { name: input.trainee.childName, birthdate: input.trainee.childBirthdate },
    parent: input.parent,
  });
  if (!sale.ok) return { ok: false, error: sale.problem };
  const { paid } = sale;

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      ...sale.columns,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: "manual",
      payment_method: input.paymentMethod,
      reference,
      received_by: input.actor.id,
    })
    .select("*")
    .single()) as { data: Order | null; error: { message: string } | null };
  if (orderError || !order) {
    console.error("[manual-payment] order insert failed:", orderError?.message);
    return { ok: false, error: "שגיאה ביצירת ההזמנה" };
  }

  // Unsigned: the parent completes and signs it from the WhatsApp link.
  const agreement = await insertUnsignedAgreement(db, {
    orderId: order.id,
    profileId: input.trainee.profileId,
    parent: input.parent,
    child: { name: input.trainee.childName, birthdate: input.trainee.childBirthdate },
    health: input.health,
    planName: product.name_he,
    priceIls: paid,
    startsOn: input.startsOn ?? israelToday(),
    paymentLabel: PAYMENT_METHOD_LABELS_HE[input.paymentMethod],
  });
  if (!agreement) {
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { ok: false, error: "שגיאה בשמירת ההסכם" };
  }

  const fulfilled = await fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: input.actor.id,
    // A chosen start holds the Plan back only while nothing is current or queued.
    chosenStartsOn: input.startsOn,
  });
  if (!fulfilled.ok) return { ok: false, error: `ההזמנה נשמרה אך היצירה נכשלה: ${fulfilled.error}` };

  const note = `${PAYMENT_METHOD_LABELS_HE[input.paymentMethod]}${reference ? ` ${reference}` : ""}`;
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .update({ note })
    .eq("id", fulfilled.planId)
    .select("starts_on, ends_on")
    .single()) as { data: Pick<TraineePlan, "starts_on" | "ends_on"> | null };

  await db.from("activity_logs").insert({
    user_id: fulfilled.profileId,
    action: "plan_granted",
    actor_id: input.actor.id,
    actor_name: input.actor.name ?? "צוות",
    metadata: {
      orderId: order.id,
      productId: product.id,
      paymentMethod: input.paymentMethod,
      reference,
      amountIls: paid,
      ...(input.discount ? { listPriceIls: sale.listPrice, discountReason: input.discount.reason } : {}),
    },
  });

  const invoice = await issueOrderInvoice(db, order.id, input.actor);
  const whatsapp = input.sendWhatsApp
    ? await notifyOrderFulfilled(db, order.id)
    : null;

  return {
    ok: true,
    orderId: order.id,
    agreementId: agreement.id,
    profileId: fulfilled.profileId,
    planId: fulfilled.planId,
    endsOn: plan?.ends_on ?? "",
    invoice: invoice.ok
      ? { url: invoice.url, error: null, skipped: false }
      : { url: null, error: invoice.skipped ? null : invoice.error, skipped: invoice.skipped },
    whatsapp: whatsapp
      ? {
          sentTo: whatsapp.confirmed?.success ? whatsapp.sentTo : null,
          error: whatsapp.shareUrl
            ? "תבנית הוואטסאפ עוד לא אושרה ב-Meta. שלחו להורה מהוואטסאפ שלכם:"
            : whatsapp.confirmed && !whatsapp.confirmed.success
              ? "השליחה נכשלה"
              : null,
          skipped: false,
          shareUrl: whatsapp.shareUrl,
        }
      : { sentTo: null, error: null, skipped: true },
    agreementUrl: agreementLink(agreement.id),
  };
}
