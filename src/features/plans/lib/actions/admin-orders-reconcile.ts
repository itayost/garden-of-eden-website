"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { lookupCharge } from "@/lib/payments/pelecard";
import { completeCardPayment, PAID_NOT_SAVED_PREFIX } from "@/features/enrollment/lib/complete-card-payment";
import type { Order } from "@/types/plans";

/**
 * A charge that has not reached Pelecard's records after this long never
 * will: only then may "no charge found" hand the order back to the parent.
 */
const RELEASE_AFTER_MS = 10 * 60 * 1000;

export type ReconcileResult =
  | { outcome: "paid"; note: string | null }
  | { outcome: "released" }
  | { error: string };

/**
 * Settles an order stuck in charging (the charge call's answer never came)
 * by asking Pelecard what the terminal recorded. A matching approved charge
 * marks the order paid and runs the same steps as the card page; no charge
 * hands the order back to pending so the parent can pay again. Admin only.
 */
export async function reconcileChargingOrderAction(orderId: string): Promise<ReconcileResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders")
    .select("id, status, amount_ils, updated_at, fulfillment_error")
    .eq("id", orderId)
    .maybeSingle()) as {
    data: Pick<Order, "id" | "status" | "amount_ils" | "updated_at" | "fulfillment_error"> | null;
  };
  if (!order) return { error: "ההזמנה לא נמצאה" };
  if (order.status !== "charging") return { error: "ההזמנה אינה בחיוב" };

  const chargingSince = new Date(order.updated_at);
  const found = await lookupCharge(order.id, Number(order.amount_ils), chargingSince);

  if (found.kind === "error") {
    console.error(`[reconcile] order ${order.id} lookup failed: ${found.reason}`);
    return { error: `הבדיקה מול פלאקארד נכשלה (${found.reason}). נסו שוב או בדקו בממשק של פלאקארד.` };
  }

  if (found.kind === "not_found") {
    // The card page saw this charge approved; a lookup that misses it is wrong.
    if (order.fulfillment_error?.startsWith(PAID_NOT_SAVED_PREFIX)) {
      return { error: `החיוב אושר בזמן התשלום ולכן ההזמנה לא תוחזר לתשלום. בדקו בפלאקארד: ${order.fulfillment_error}` };
    }
    if (Date.now() - chargingSince.getTime() < RELEASE_AFTER_MS) {
      return { error: "לא נמצא חיוב עדיין. נסו שוב בעוד כמה דקות, לפני שמחזירים את ההזמנה לתשלום." };
    }
    const { data: released } = (await typedFrom(db, "orders")
      .update({ status: "pending", fulfillment_error: null })
      .eq("id", order.id)
      .eq("status", "charging")
      .select("id")) as { data: { id: string }[] | null };
    if (!released?.length) return { error: "ההזמנה השתנתה בינתיים. רעננו את הדף." };
    revalidatePath("/admin/orders");
    return { outcome: "released" };
  }

  const completion = await completeCardPayment(
    db,
    order.id,
    {
      provider: "isracard",
      transactionId: found.transactionId,
      approvalNumber: found.approvalNumber,
      cardBrand: null,
      cardLast4: found.last4,
      installments: found.installments,
      raw: found.raw,
    },
    { id: user!.id, name: adminProfile?.full_name ?? null },
  );
  revalidatePath("/admin/orders");
  revalidatePath("/admin/plans");
  switch (completion.status) {
    case "completed":
    case "already_paid":
      return { outcome: "paid", note: null };
    case "fulfillment_failed":
      return { outcome: "paid", note: `החיוב נמצא וההזמנה סומנה כשולמה, אך המסלול לא נוצר: ${completion.error}` };
    case "claim_failed":
      return { error: `החיוב נמצא בפלאקארד אך לא נשמר: ${completion.error}` };
  }
}
