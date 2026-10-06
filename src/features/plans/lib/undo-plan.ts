import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { countedRowIds } from "@/lib/schedule/booking-rules";
import { guardRefusal, type PlanContext } from "./plan-context";
import { planStamps } from "./queries";

type RefundRow = Pick<
  Database["public"]["Tables"]["plan_refunds"]["Insert"],
  "reason" | "amount_ils" | "method" | "reference" | "proposed_amount_ils" | "override_reason" | "defect" | "created_by"
>;

/**
 * The write half of an undo act (Void, Cancellation): undo_plan sets the
 * Plan, writes the plan_refunds audit row and marks the order in one
 * transaction, under the per-trainee booking lock, and refuses if the
 * Trainee's roster or Plans changed since ctx was read. So two staff cannot
 * undo it twice, and a Booking made in between cannot escape the shrink rule.
 */
export async function claimAndRecordUndo(
  db: SupabaseClient<Database>,
  ctx: PlanContext,
  undo: {
    plan: { status: "voided" } | { status: "cancelled"; ended_on: string };
    refund: RefundRow;
    /** Null leaves the order as it is. */
    orderStatus: "voided" | "refunded" | null;
  },
): Promise<{ refundId: string } | { error: string }> {
  const { refund } = undo;
  const { data: refundId, error } = await db.rpc("undo_plan", {
    p_plan_id: ctx.plan.id,
    p_status: undo.plan.status,
    // The generated types mark every argument required; NULL is how SQL reads an absent one.
    p_ended_on: (undo.plan.status === "cancelled" ? undo.plan.ended_on : null) as string,
    p_kind: undo.plan.status === "voided" ? "void" : "cancellation",
    p_reason: refund.reason,
    p_amount_ils: refund.amount_ils,
    p_proposed_amount_ils: (refund.proposed_amount_ils ?? null) as number,
    p_override_reason: (refund.override_reason ?? null) as string,
    p_defect: refund.defect ?? false,
    p_method: refund.method,
    p_reference: (refund.reference ?? null) as string,
    p_order_status: undo.orderStatus as string,
    p_actor: refund.created_by,
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_plan_stamps: planStamps(ctx.plans),
  });
  if (error || !refundId) {
    const known = error && guardRefusal(error.message);
    if (known) return { error: known };
    console.error("[undo] undo_plan failed:", error?.message);
    return { error: "הפעולה נכשלה. נסו שוב." };
  }
  return { refundId };
}
