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

/** The refund note, ahead of whatever note the order already carried. */
export function refundNote(
  existing: string | null,
  details: { pelecardId: string; approvalNumber: string | null; reason: string },
): string {
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
 * When Pelecard could not confirm a result: a decline hint is believed,
 * because a forged one only hurts whoever forged it (and the callback still
 * settles a real payment); anything else holds the order for an admin.
 */
export function unverifiedOutcome(hintCode: string | null): SettleOutcome {
  if (hintCode && /^\d{3}$/.test(hintCode) && hintCode !== "000") return { kind: "not_paid", code: hintCode };
  return { kind: "unverified" };
}
