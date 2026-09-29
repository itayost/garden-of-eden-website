import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { fulfillOrder } from "./fulfillment";
import { issueOrderInvoice } from "./invoice";
import { markOrderPaid, type PaidReference } from "./mark-paid";
import { notifyOrderFulfilled } from "./notify";

/** Marks a note on an order whose card was charged but not saved as paid. */
export const PAID_NOT_SAVED_PREFIX = "paid, claim failed:";

export type CardPaymentCompletion =
  | { status: "completed" }
  /** Someone else already moved the order to paid; they own the rest. */
  | { status: "already_paid" }
  /** Paid, but the plan was not created; fulfillment_error says why. */
  | { status: "fulfillment_failed"; error: string }
  /** Charged, but the order could not be marked paid; fulfillment_error says why. */
  | { status: "claim_failed"; error: string };

/**
 * Everything after the card was charged, shared by the card page and the
 * admin reconcile of a stuck order: mark paid, create the plan, issue the
 * Morning receipt, message the parent. Each step is idempotent, so a rerun
 * after a partial failure only does what is missing.
 */
export async function completeCardPayment(
  db: SupabaseClient,
  orderId: string,
  ref: PaidReference,
  issuer: { id: string | null; name: string | null },
): Promise<CardPaymentCompletion> {
  const claim = await markOrderPaid(db, orderId, ref);
  if (claim.error) {
    console.error(`[card-payment] order ${orderId} paid but not claimed:`, claim.error);
    // Keep the acquirer's reference on the row: reconcile must never hand
    // this order back to the parent, and an admin needs it to match the charge.
    const reference = [ref.transactionId && `transaction ${ref.transactionId}`, ref.approvalNumber && `approval ${ref.approvalNumber}`]
      .filter(Boolean)
      .join(", ");
    await typedFrom(db, "orders")
      .update({ fulfillment_error: `${PAID_NOT_SAVED_PREFIX} ${claim.error}${reference ? ` (${reference})` : ""}` })
      .eq("id", orderId);
    return { status: "claim_failed", error: claim.error };
  }
  if (!claim.claimed) return { status: "already_paid" };

  const fulfilled = await fulfillOrder(db, orderId);
  // fulfillment_error is already set; the admin retries from /admin/orders.
  if (!fulfilled.ok) return { status: "fulfillment_failed", error: fulfilled.error };

  await issueOrderInvoice(db, orderId, issuer);
  await notifyOrderFulfilled(db, orderId);
  return { status: "completed" };
}
