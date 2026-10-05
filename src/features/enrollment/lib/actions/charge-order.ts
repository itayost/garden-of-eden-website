"use server";

import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectBrand, last4 } from "@/lib/payments/card";
import { chargeCard } from "@/lib/payments/pelecard";
import { canPayOnline, PAYMENTS_CLOSED_MESSAGE } from "@/lib/payments/online-payments";
import { cardPaymentSchema, type CardPaymentInput } from "@/lib/validations/card-payment";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import { sameTraineeOrders } from "@/lib/plans/bound-renewal";
import { capturedPriceHolds } from "@/lib/plans/discount";
import type { Order, PlanProduct } from "@/types/plans";
import { completeCardPayment } from "../complete-card-payment";

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
  if (!(await canPayOnline())) return { error: PAYMENTS_CLOSED_MESSAGE };

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
  // sale at the price the order captured (a staff Discount keeps its amount).
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("id, name_he, price_ils, is_active, once_per_trainee")
    .eq("id", order.product_id)
    .maybeSingle()) as {
    data: Pick<PlanProduct, "id" | "name_he" | "price_ils" | "is_active" | "once_per_trainee"> | null;
  };
  const captured = {
    amountIls: Number(order.amount_ils),
    listPriceIls: order.list_price_ils === null ? null : Number(order.list_price_ils),
  };
  if (!product || !product.is_active || !capturedPriceHolds(Number(product.price_ils), captured)) {
    return { error: "המסלול או המחיר השתנו. התחילו הרשמה חדשה." };
  }
  // A Payment link's agreement is signed by the parent before the card page;
  // the online form signs its own when the order is made.
  const { count: signed } = await typedFrom(db, "enrollment_agreements")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .not("signed_at", "is", null);
  if (!signed) return { error: "יש לחתום על ההסכם לפני התשלום." };
  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .or(sameTraineeOrders(order.login_phone, order.profile_id))
      // A refunded intro pack was still sold; only a Void undoes the sale.
      .in("status", ["paid", "refunded"])
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות כבר נרכשה למספר הזה. בחרו מסלול אחר." };
    }
  }
  const description = `${product.name_he} - ${order.child_name}`;

  // Per order, so declines cannot turn one order into a card-testing tool.
  // Counted here, past every refusal that sends nothing to Pelecard.
  const orderLimit = await checkRateLimit(`order:${order.id}`, "payment_order");
  waitUntil(orderLimit.pending);
  if (orderLimit.rateLimited) {
    return { error: "יותר מדי ניסיונות תשלום להזמנה הזו. כתבו לנו בוואטסאפ 052-577-9446 ונשלים יחד." };
  }

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
    return { error: "לא קיבלנו תשובה מחברת הסליקה, וייתכן שהחיוב בוצע. אל תנסו שוב לפני שדיברתם איתנו בוואטסאפ 052-577-9446." };
  }
  if (!charge.ok) {
    await releaseToPending();
    return { error: charge.message };
  }

  // The card was charged: whatever fails from here is the admin's to finish
  // (the helper leaves fulfillment_error), never the parent's to retry.
  await completeCardPayment(
    db,
    order.id,
    {
      provider: "isracard",
      transactionId: charge.transactionId,
      approvalNumber: charge.approvalNumber,
      cardBrand: detectBrand(data.cardNumber),
      cardLast4: last4(data.cardNumber),
      installments: data.installments,
      raw: charge.raw,
    },
    { id: null, name: null },
  );
  return { ok: true };
}
