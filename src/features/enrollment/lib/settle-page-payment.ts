import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { toAgorot } from "@/lib/payments/pelecard-mapping";
import { getPageTransaction, validatePagePayment } from "@/lib/payments/pelecard";
import { judgePagePayment, type PageTransaction, type PageVerdict } from "@/lib/payments/pelecard-page-mapping";
import {
  paidOrderAction,
  refundNote,
  SUPERSEDED_NOTE,
  UNVERIFIED_NOTE,
  unverifiedOutcome,
  type SettleOutcome,
} from "@/lib/payments/page-settlement";
import { closeNewerPaymentLinks, newerPaymentLinkPaid } from "@/features/plans/lib/payment-link-supersede";
import type { Order } from "@/types/plans";
import { completeCardPayment } from "./complete-card-payment";
import type { PaidReference } from "./mark-paid";

type OrderRow = Pick<
  Order,
  "id" | "status" | "amount_ils" | "fulfillment_error" | "provider_transaction_id" | "profile_id" | "created_at"
>;

const ORDER_COLUMNS = "id, status, amount_ils, fulfillment_error, provider_transaction_id, profile_id, created_at";

const NO_ISSUER = { id: null, name: null };

/**
 * Settles one payment made on Pelecard's payment page, for the return route
 * and the server-side callback alike. Both only say which order and which
 * transaction to ask about: nothing changes until GetTransaction and
 * ValidateByUniqueKey confirm a payment of this order's amount. Safe to run
 * twice for the same payment.
 */
export async function settlePagePayment(
  db: SupabaseClient,
  input: { orderId: string; transactionId: string; hintCode: string | null },
): Promise<SettleOutcome> {
  const { data: order, error } = (await typedFrom(db, "orders")
    .select(ORDER_COLUMNS)
    .eq("id", input.orderId)
    .maybeSingle()) as { data: OrderRow | null; error: { message: string } | null };
  if (error) {
    console.error(`[pelecard-page] order ${input.orderId} read failed:`, error.message);
    return unverifiedOutcome(input.hintCode);
  }
  if (!order) return { kind: "ignored", reason: "no such order" };

  const fetched = await getPageTransaction(input.transactionId);
  if (!fetched.ok) return holdUnverified(db, order, input.hintCode, fetched.reason);

  const verdict = await verdictFor(fetched.tx, order);
  switch (verdict.kind) {
    case "paid":
      return applyPaid(db, order, fetched.tx);
    case "not_paid":
      return { kind: "not_paid", code: verdict.code };
    case "unknown":
      return holdUnverified(db, order, input.hintCode, verdict.reason);
    case "needs_validation":
      return holdUnverified(db, order, input.hintCode, "validation did not run");
  }
}

async function verdictFor(tx: PageTransaction, order: OrderRow): Promise<PageVerdict> {
  const amountIls = Number(order.amount_ils);
  const first = judgePagePayment(tx, { id: order.id, amountIls }, "not_checked");
  if (first.kind !== "needs_validation") return first;
  const validation = tx.confirmationKey
    ? await validatePagePayment(tx.confirmationKey, order.id, toAgorot(amountIls))
    : "error";
  return judgePagePayment(tx, { id: order.id, amountIls }, validation);
}

/** Holds an order whose result could not be confirmed, unless the hint was a decline. */
async function holdUnverified(
  db: SupabaseClient,
  order: OrderRow,
  hintCode: string | null,
  reason: string,
): Promise<SettleOutcome> {
  console.warn(`[pelecard-page] order ${order.id} not verified: ${reason}`);
  const outcome = unverifiedOutcome(hintCode);
  if (outcome.kind !== "unverified") return outcome;
  const { error } = (await typedFrom(db, "orders")
    .update({ status: "charging", fulfillment_error: UNVERIFIED_NOTE })
    .eq("id", order.id)
    .in("status", ["pending", "expired"])) as { error: { message: string } | null };
  if (error) console.error(`[pelecard-page] order ${order.id} hold failed:`, error.message);
  return outcome;
}

function paidReference(tx: PageTransaction): PaidReference {
  return {
    provider: "isracard",
    transactionId: tx.pelecardId ?? tx.transactionId,
    approvalNumber: tx.approvalNumber,
    cardBrand: tx.brand,
    cardLast4: tx.last4,
    installments: tx.installments,
    raw: tx.raw,
  };
}

async function flagRefund(
  db: SupabaseClient,
  orderId: string,
  existing: string | null,
  tx: PageTransaction,
  reason: string,
): Promise<SettleOutcome> {
  const note = refundNote(existing, {
    pelecardId: tx.pelecardId ?? tx.transactionId,
    approvalNumber: tx.approvalNumber,
    reason,
  });
  const { error } = (await typedFrom(db, "orders").update({ fulfillment_error: note }).eq("id", orderId)) as {
    error: { message: string } | null;
  };
  console.error(`[pelecard-page] order ${orderId} refund flagged: ${reason}${error ? ` (note not saved: ${error.message})` : ""}`);
  return { kind: "refund_flagged" };
}

function refundReason(order: OrderRow): string {
  if (order.status === "paid") return "paid twice";
  if (order.status === "failed" && order.fulfillment_error === SUPERSEDED_NOTE) {
    return "a newer Payment link was already paid";
  }
  return `paid on a ${order.status} order`;
}

async function applyPaid(
  db: SupabaseClient,
  order: OrderRow,
  tx: PageTransaction,
  retried = false,
): Promise<SettleOutcome> {
  const ref = paidReference(tx);
  const pelecardId = ref.transactionId ?? tx.transactionId;
  const superseded = order.status === "failed" && order.fulfillment_error === SUPERSEDED_NOTE;
  const newerLinkPaid = superseded ? await newerPaymentLinkPaid(db, order) : false;

  switch (paidOrderAction(order, pelecardId, newerLinkPaid)) {
    case "already_done":
      return { kind: "paid" };
    case "flag_refund":
      return flagRefund(db, order.id, order.fulfillment_error, tx, refundReason(order));
    case "complete":
      return finish(db, order, tx, ref, {}, retried);
    case "complete_superseded": {
      const outcome = await finish(db, order, tx, ref, { allowSuperseded: true }, retried);
      if (outcome.kind === "paid") await closeNewerPaymentLinks(db, order);
      return outcome;
    }
  }
}

/**
 * Runs the shared completion. When the claim found the order already moved
 * (the other half of return plus callback, a second tab, or a newer Payment
 * link closing it at that moment), reads it again and applies the rules
 * once more, so a second charge is flagged and a superseded link is still
 * honored.
 */
async function finish(
  db: SupabaseClient,
  order: OrderRow,
  tx: PageTransaction,
  ref: PaidReference,
  opts: { allowSuperseded?: boolean },
  retried: boolean,
): Promise<SettleOutcome> {
  const completion = await completeCardPayment(db, order.id, ref, NO_ISSUER, opts);
  if (completion.status === "claim_failed") return { kind: "unverified" };
  if (completion.status !== "already_paid") return { kind: "paid" };

  const { data: fresh } = (await typedFrom(db, "orders")
    .select(ORDER_COLUMNS)
    .eq("id", order.id)
    .maybeSingle()) as { data: OrderRow | null };
  if (!fresh) return flagRefund(db, order.id, order.fulfillment_error, tx, "order vanished after payment");
  if (retried) return flagRefund(db, fresh.id, fresh.fulfillment_error, tx, refundReason(fresh));
  return applyPaid(db, fresh, tx, true);
}
