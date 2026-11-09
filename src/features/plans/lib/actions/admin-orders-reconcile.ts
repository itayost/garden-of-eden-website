"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { lookupCharge } from "@/lib/payments/pelecard";
import { canCheckWithPelecard, refundNote } from "@/lib/payments/page-settlement";
import { closeNewerPaymentLinks, otherPaymentLinkPaidSince } from "../payment-link-supersede";
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
  | { outcome: "not_found" }
  | { outcome: "refund_flagged" }
  | { error: string };

/**
 * Asks Pelecard what the terminal recorded for an order: one held in
 * charging (its result never arrived or could not be confirmed), or an open
 * card order whose payment may have landed while the redirect and the
 * callback were both lost. A matching approved charge marks the order paid
 * and runs the same steps as the card page. With no charge, a held order
 * goes back to pending so the parent can pay again; an open one stays as it
 * is. Admin or the branch's manager.
 */
export async function reconcileChargingOrderAction(orderId: string): Promise<ReconcileResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders")
    .select("id, status, payment_provider, amount_ils, created_at, updated_at, fulfillment_error, branch_id, profile_id")
    .eq("id", orderId)
    .maybeSingle()) as {
    data: Pick<
      Order,
      | "id"
      | "status"
      | "payment_provider"
      | "amount_ils"
      | "created_at"
      | "updated_at"
      | "fulfillment_error"
      | "branch_id"
      | "profile_id"
    > | null;
  };
  if (!order) return { error: "ההזמנה לא נמצאה" };
  const denied = await verifyAdminOrBranchManager([order.branch_id]);
  if (denied) return { error: denied };
  if (!canCheckWithPelecard(order)) return { error: "אין מה לבדוק בהזמנה הזו מול פלאקארד" };

  // An open or superseded order's Pelecard pages may date from its creation; a held one's charge from the hold.
  const held = order.status === "charging";
  const chargingSince = new Date(held ? order.updated_at : order.created_at);
  const found = await lookupCharge(order.id, Number(order.amount_ils), chargingSince);

  if (found.kind === "error") {
    console.error(`[reconcile] order ${order.id} lookup failed: ${found.reason}`);
    return { error: `הבדיקה מול פלאקארד נכשלה (${found.reason}). נסו שוב או בדקו בממשק של פלאקארד.` };
  }

  if (found.kind === "not_found" && !held) return { outcome: "not_found" };

  // A link a newer Payment link closed: honored like the card page does,
  // unless another link for the child was paid since.
  const superseded = order.status === "failed";
  if (found.kind === "found" && superseded && (await otherPaymentLinkPaidSince(db, order))) {
    const note = refundNote(order.fulfillment_error, {
      pelecardId: found.transactionId,
      approvalNumber: found.approvalNumber,
      reason: "another Payment link for this child was already paid",
    });
    await typedFrom(db, "orders").update({ fulfillment_error: note }).eq("id", order.id);
    revalidatePath("/admin/orders");
    return { outcome: "refund_flagged" };
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
    { id: user!.id, name: profile?.full_name ?? null },
    { allowSuperseded: superseded },
  );
  if (superseded && completion.status === "completed") await closeNewerPaymentLinks(db, order);
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
