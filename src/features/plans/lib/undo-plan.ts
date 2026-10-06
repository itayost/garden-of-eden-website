import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { QueueRow } from "@/lib/plans/plan-queue";
import { guardedShrinkArgs } from "./apply-shrink";
import { actFailure, type PlanContext } from "./plan-context";

type RefundRow = Pick<
  Database["public"]["Tables"]["plan_refunds"]["Insert"],
  "reason" | "amount_ils" | "method" | "reference" | "proposed_amount_ils" | "override_reason" | "defect" | "created_by"
>;

/**
 * An undo act (Void, Cancellation), whole or not at all: undo_plan sets the
 * Plan, writes the plan_refunds audit row, marks the order, cancels the
 * Bookings the shrink rule drops and writes the activity record (the act's
 * common fields, logExtra and the refund id), in one transaction under the
 * per-trainee booking lock. It refuses if the Trainee's roster or Plans changed since ctx was
 * read, so two staff cannot undo it twice and a Booking made in between
 * cannot escape the shrink rule.
 */
export async function undoPlan(
  db: SupabaseClient<Database>,
  ctx: PlanContext,
  undo: {
    plan: { status: "voided" } | { status: "cancelled"; ended_on: string };
    refund: RefundRow;
    /** Null leaves the order as it is. */
    orderStatus: "voided" | "refunded" | null;
    /** The Bookings the shrink rule cancels, latest first. */
    cancelled: readonly QueueRow[];
    /** How many Bookings a Queued plan now pays for. */
    movedCount: number;
    actorName: string;
    /** What this act logs beyond the common fields. */
    logExtra?: { [key: string]: Json };
  },
): Promise<{ refundId: string } | { error: string }> {
  const { refund } = undo;
  const { data: refundId, error } = await db.rpc("undo_plan", {
    p_plan_id: ctx.plan.id,
    p_status: undo.plan.status,
    // The generated types mark every argument required; NULL is how SQL reads an absent one.
    p_ended_on: (undo.plan.status === "cancelled" ? undo.plan.ended_on : null) as string,
    p_reason: refund.reason,
    p_amount_ils: refund.amount_ils,
    p_proposed_amount_ils: (refund.proposed_amount_ils ?? null) as number,
    p_override_reason: (refund.override_reason ?? null) as string,
    p_defect: refund.defect ?? false,
    p_method: refund.method,
    p_reference: (refund.reference ?? null) as string,
    p_order_status: undo.orderStatus as string,
    p_actor: refund.created_by,
    p_actor_name: undo.actorName,
    p_log_metadata: {
      planId: ctx.plan.id,
      orderId: ctx.order?.id ?? null,
      reason: refund.reason,
      amountIls: refund.amount_ils,
      method: refund.method,
      bookingsMoved: undo.movedCount,
      bookingsCancelled: undo.cancelled.length,
      ...undo.logExtra,
    },
    ...guardedShrinkArgs(ctx, undo.cancelled),
  });
  if (error || !refundId) return { error: actFailure("undo", error, "הפעולה נכשלה. נסו שוב.") };
  return { refundId };
}
