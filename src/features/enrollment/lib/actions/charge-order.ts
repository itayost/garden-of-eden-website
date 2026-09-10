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
  if (order.status === "failed") return { error: "ההזמנה בוטלה. התחילו הרשמה חדשה." };

  const { data: product } = (await typedFrom(db, "plan_products")
    .select("name_he")
    .eq("id", order.product_id)
    .maybeSingle()) as { data: Pick<PlanProduct, "name_he"> | null };
  const description = `${product?.name_he ?? "מסלול"} - ${order.child_name}`;

  const charge = await chargeCard({
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
  if (!charge.ok) return { error: charge.message };

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
