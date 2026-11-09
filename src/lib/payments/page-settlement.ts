import type { OrderStatus } from "@/types/plans";

/**
 * Pure rules for settling a payment made on Pelecard's payment page, once
 * Pelecard itself has confirmed it. The page can be open in two tabs, and a
 * newer Payment link can close the order while the parent is still paying,
 * so a confirmed payment does not always mean "complete this order".
 */

/** Written by a new Payment link on the child's older unpaid links. */
export const SUPERSEDED_NOTE = "replaced by a newer Payment link";

/** An order whose Pelecard result could not be confirmed; an admin reconciles it. */
export const UNVERIFIED_NOTE = "Pelecard result not verified; reconcile";

/** Leads a note on an order whose payment must be refunded by hand in Pelecard. */
export const REFUND_FLAG_PREFIX = "refund in Pelecard:";

export type PaidOrderAction = "complete" | "complete_superseded" | "already_done" | "flag_refund";

export type SettleOutcome =
  | { kind: "paid" }
  | { kind: "refund_flagged" }
  | { kind: "not_paid"; code: string }
  | { kind: "unverified" }
  | { kind: "ignored"; reason: string };

/**
 * What a confirmed payment does to the order it was made for. Open orders
 * complete. The same transaction again (return and callback both arrive)
 * changes nothing; a different one on a paid order is a second charge to
 * refund. A link closed by a newer Payment link is honored (Itay,
 * 2026-11-09) unless a newer link was already paid; any other closed order
 * is refunded.
 */
export function paidOrderAction(
  order: { status: OrderStatus; fulfillment_error: string | null; provider_transaction_id: string | null },
  pelecardId: string,
  newerLinkPaid: boolean,
): PaidOrderAction {
  switch (order.status) {
    case "pending":
    case "expired":
    case "charging":
      return "complete";
    case "paid":
      return order.provider_transaction_id === pelecardId ? "already_done" : "flag_refund";
    case "failed":
      return order.fulfillment_error === SUPERSEDED_NOTE && !newerLinkPaid ? "complete_superseded" : "flag_refund";
    default:
      return "flag_refund";
  }
}

/**
 * A PostgREST .or() filter matching orders whose note is not a refund flag,
 * so fulfillment and invoice writes never erase one. The value is quoted:
 * it contains a space and a colon.
 */
export const KEEP_REFUND_FLAG_FILTER = `fulfillment_error.is.null,fulfillment_error.not.like."${REFUND_FLAG_PREFIX}*"`;

/**
 * The refund note, ahead of whatever note the order already carried. The
 * same transaction flagged again (its return and its callback) changes
 * nothing.
 */
export function refundNote(
  existing: string | null,
  details: { pelecardId: string; approvalNumber: string | null; reason: string },
): string {
  if (existing && isRefundFlag(existing) && existing.includes(`transaction ${details.pelecardId}`)) return existing;
  const approval = details.approvalNumber ? `, approval ${details.approvalNumber}` : "";
  const note = `${REFUND_FLAG_PREFIX} ${details.reason}, transaction ${details.pelecardId}${approval}`;
  return existing ? `${note} | ${existing}` : note;
}

/** Where the return route sends the parent after settling. */
export function returnRedirect(outcome: SettleOutcome, orderId: string): string {
  switch (outcome.kind) {
    case "paid":
    case "refund_flagged":
    case "unverified":
      return `/join/success?order=${orderId}`;
    case "not_paid":
      return `/join/pay/${orderId}?declined=${outcome.code}`;
    case "ignored":
      return `/join/pay/${orderId}`;
  }
}

/** A note asking an admin to refund a payment by hand in Pelecard. */
export function isRefundFlag(note: string | null): boolean {
  return note?.startsWith(REFUND_FLAG_PREFIX) ?? false;
}

/**
 * Orders the admin may check against Pelecard: one held in charging, and
 * an open card order (online or a Payment link), whose payment may have
 * landed while both the redirect and the callback were lost. Staff
 * payments (manual) are paid on the spot and never wait on Pelecard.
 */
export function canCheckWithPelecard(order: { status: OrderStatus; payment_provider: string }): boolean {
  if (order.status === "charging") return true;
  return order.status === "pending" && order.payment_provider !== "manual";
}

/**
 * Why a result was not a confirmed payment: Pelecard's answer could not be
 * read, its transaction has no result yet, it belongs to another order, or
 * it is this order's transaction with money moved that does not add up.
 */
export type NoPaymentReason = "unreadable" | "unfinished" | "not_ours" | "ambiguous";

export interface NoPaymentPlan {
  outcome: SettleOutcome;
  /** Move the order to charging for an admin (money moved on this order). */
  hold: boolean;
  /** Show "being checked" on the card page for a while instead of a new page. */
  markChecking: boolean;
}

/**
 * What to do without a confirmed payment. Only this order's own transaction
 * with money moved holds the order in the database, whatever the browser's
 * hint says. When Pelecard cannot say yet, a decline hint is believed;
 * otherwise the card page only says "being checked" for a while, which
 * writes nothing anyone could abuse to lock the order. Another order's
 * transaction is ignored.
 */
export function planWithoutPayment(reason: NoPaymentReason, hintCode: string | null): NoPaymentPlan {
  if (reason === "ambiguous") return { outcome: { kind: "unverified" }, hold: true, markChecking: false };
  if (reason === "not_ours") {
    return { outcome: { kind: "ignored", reason: "the transaction belongs to another order" }, hold: false, markChecking: false };
  }
  const hinted = unverifiedOutcome(hintCode);
  return { outcome: hinted, hold: false, markChecking: hinted.kind === "unverified" };
}

/**
 * When Pelecard could not confirm a result: a decline hint is believed,
 * because a forged one only hurts whoever forged it (and the callback still
 * settles a real payment); anything else holds the order for an admin.
 */
export function unverifiedOutcome(hintCode: string | null): SettleOutcome {
  if (hintCode && /^\d{3}$/.test(hintCode) && hintCode !== "000") return { kind: "not_paid", code: hintCode };
  return { kind: "unverified" };
}
