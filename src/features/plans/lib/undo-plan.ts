import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PlanContext } from "./plan-context";

type RefundRow = Omit<Database["public"]["Tables"]["plan_refunds"]["Insert"], "plan_id" | "order_id">;

/**
 * The write half of an undo act (Void, Cancellation): claim the Plan, write
 * the plan_refunds audit row, then mark the order. The claim matches the
 * status the Plan was read with, so two staff cannot undo it twice; any
 * later failure puts the Plan back exactly as it was.
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
  const planId = ctx.plan.id;
  // Matched on both fields it was read with: an Early end in between leaves
  // the status alone but sets ended_on, and must stop this claim.
  const base = db
    .from("trainee_plans")
    .update({ ...undo.plan, ...(undo.plan.status === "voided" ? { ended_on: null } : {}) })
    .eq("id", planId)
    .eq("status", ctx.plan.status);
  const { data: claimed, error: claimError } = await (ctx.plan.ended_on
    ? base.eq("ended_on", ctx.plan.ended_on)
    : base.is("ended_on", null)
  ).select("id");
  if (claimError) {
    console.error("[undo] plan update failed:", claimError.message);
    return { error: "הפעולה נכשלה. נסו שוב." };
  }
  if (!claimed?.length) return { error: "המסלול השתנה בינתיים. פתחו אותו מחדש ונסו שוב." };
  const restore = () =>
    db.from("trainee_plans").update({ status: ctx.plan.status, ended_on: ctx.plan.ended_on }).eq("id", planId);

  const { data: refund, error: refundError } = await db
    .from("plan_refunds")
    .insert({ ...undo.refund, plan_id: planId, order_id: ctx.order?.id ?? null })
    .select("id")
    .single();
  if (refundError || !refund) {
    console.error("[undo] refund record failed:", refundError?.message);
    await restore();
    return { error: "שמירת הפעולה נכשלה. נסו שוב." };
  }

  if (ctx.order && undo.orderStatus) {
    const { error: orderError } = await db.from("orders").update({ status: undo.orderStatus }).eq("id", ctx.order.id);
    if (orderError) {
      // A Plan undone on an order still marked paid would count as revenue: undo it all.
      console.error("[undo] order update failed:", orderError.message);
      await db.from("plan_refunds").delete().eq("id", refund.id);
      await restore();
      return { error: "הפעולה נכשלה. נסו שוב." };
    }
  }
  return { refundId: refund.id };
}
