"use server";

import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectBrand, last4 } from "@/lib/payments/card";
import { chargeCard } from "@/lib/payments/isracard";
import { isMorningConfigured } from "@/lib/morning/config";
import { createInvoiceReceipt } from "@/lib/morning/documents";
import { israelToday } from "@/lib/utils/tasks";
import { cardPaymentSchema, type CardPaymentInput } from "@/lib/validations/card-payment";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import type { Order, PlanProduct } from "@/types/plans";
import { fulfillOrder } from "../fulfillment";
import { markOrderPaid } from "../mark-paid";
import { notifyOrderFulfilled } from "../notify";

type ChargeResult = { ok: true } | { error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Charges the card for one pending order and turns it into a plan.
 *
 * Card data lives in this function's arguments and nowhere else: it is not
 * stored, not logged, and only the brand and last four digits survive on the
 * order. Unauthenticated (the parent has no account yet); the payment rate
 * limit is the abuse guard, and the amount always comes from the order row.
 */
export async function chargeOrderAction(input: CardPaymentInput): Promise<ChargeResult> {
  const limit = await checkRateLimit(`ip:${await clientIp()}`, "payment");
  waitUntil(limit.pending);
  if (limit.rateLimited) {
    // limit 0 means the limiter itself is unavailable (no Redis): say so
    // rather than blame the parent for attempts they never made.
    return {
      error:
        limit.limit === 0
          ? "מערכת התשלום אינה זמינה כרגע. נסו שוב בעוד מספר דקות או כתבו לנו בוואטסאפ."
          : "יותר מדי ניסיונות. נסו שוב בעוד שעה.",
    };
  }

  const parsed = cardPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטי הכרטיס לא תקינים" };
  const data = parsed.data;

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", data.orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order) return { error: "ההזמנה לא נמצאה" };
  if (order.status === "paid") return { ok: true };
  if (order.status === "charging") return { error: "התשלום כבר בטיפול. המתינו רגע." };
  if (order.status === "failed") return { error: "ההזמנה בוטלה. התחילו הרשמה חדשה." };

  // An expired order may be paid, but only for a product that is still on
  // sale at the price the order captured.
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("id, name_he, price_ils, is_active, once_per_trainee")
    .eq("id", order.product_id)
    .maybeSingle()) as {
    data: Pick<PlanProduct, "id" | "name_he" | "price_ils" | "is_active" | "once_per_trainee"> | null;
  };
  if (!product || !product.is_active || Number(product.price_ils) !== Number(order.amount_ils)) {
    return { error: "המסלול או המחיר השתנו. התחילו הרשמה חדשה." };
  }
  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .eq("login_phone", order.login_phone)
      .eq("status", "paid")
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות כבר נרכשה למספר הזה. בחרו מסלול אחר." };
    }
  }
  const description = `${product.name_he} - ${order.child_name}`;

  // Claim the order before the card goes anywhere: a double tap, a second
  // tab, or a retry after a timeout finds nothing to claim and stops here
  // instead of charging twice.
  const { data: claimedRows, error: claimError } = (await typedFrom(db, "orders")
    .update({ status: "charging" })
    .eq("id", order.id)
    .in("status", ["pending", "expired"])
    .select("id")) as { data: { id: string }[] | null; error: { message: string } | null };
  if (claimError) return { error: "שגיאה זמנית. נסו שוב." };
  if (!claimedRows || claimedRows.length === 0) return { error: "התשלום כבר בטיפול. המתינו רגע." };

  const releaseToPending = async () => {
    await typedFrom(db, "orders")
      .update({ status: "pending" })
      .eq("id", order.id)
      .eq("status", "charging");
  };

  let charge;
  try {
    charge = await chargeCard({
    orderId: order.id,
    amountIls: Number(order.amount_ils),
    installments: data.installments,
    description,
    card: {
      number: data.cardNumber,
      expMonth: data.expMonth,
      expYear: data.expYear,
      cvv: data.cvv,
      holderName: data.holderName,
      holderId: data.holderId,
    },
    payer: { name: order.parent_name, phone: order.payer_phone, email: order.email },
    });
  } catch (error) {
    // The acquirer may or may not have captured. Keep the row in charging
    // so an admin reconciles it; never let the parent retry blind.
    console.error(`[charge-order] order ${order.id} charge threw:`, error instanceof Error ? error.message : error);
    await typedFrom(db, "orders")
      .update({ fulfillment_error: "charge threw; reconcile with the acquirer" })
      .eq("id", order.id);
    return { error: "התשלום לא אושר. אל תנסו שוב לפני שדיברתם איתנו בוואטסאפ 052-577-9446." };
  }
  if (!charge.ok) {
    await releaseToPending();
    return { error: charge.message };
  }

  const brand = detectBrand(data.cardNumber);
  const claim = await markOrderPaid(db, order.id, {
    provider: "isracard",
    transactionId: charge.transactionId,
    approvalNumber: charge.approvalNumber,
    cardBrand: brand,
    cardLast4: last4(data.cardNumber),
    installments: data.installments,
    raw: charge.raw,
  });
  if (claim.error) {
    // The card was charged. Leave a trail for the admin rather than fail silently.
    console.error(`[charge-order] order ${order.id} paid but not claimed:`, claim.error);
    await typedFrom(db, "orders")
      .update({ fulfillment_error: `paid, claim failed: ${claim.error}` })
      .eq("id", order.id);
    return { ok: true };
  }
  if (!claim.claimed) return { ok: true };

  const fulfilled = await fulfillOrder(db, order.id);
  if (!fulfilled.ok) {
    // fulfillment_error is already set; the admin retries from /admin/orders.
    return { ok: true };
  }

  if (isMorningConfigured()) {
    const doc = await createInvoiceReceipt({
      description,
      amountIls: Number(order.amount_ils),
      paidOn: israelToday(),
      client: { name: order.parent_name, phone: order.payer_phone, email: order.email },
      card: { brand, last4: last4(data.cardNumber), installments: data.installments },
    });
    await typedFrom(db, "orders")
      .update(
        doc.ok
          ? { morning_document_id: doc.id, morning_document_url: doc.url }
          : { fulfillment_error: `invoice: ${doc.error}` },
      )
      .eq("id", order.id);
  }

  await notifyOrderFulfilled(db, order.id);
  return { ok: true };
}
