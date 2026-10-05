"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { planAdjustment } from "@/lib/plans/adjustment";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { adjustSessionsSchema, type AdjustSessionsInput } from "@/lib/validations/plans-admin";
import { applyShrinkAfter } from "../apply-shrink";
import { countedRowIds, loadPlanContext, STALE_READ, withPlanChange, type PlanContext } from "../plan-context";

const BALANCE_CHANGED = "היתרה השתנתה בינתיים. רעננו ונסו שוב.";

export interface AdjustmentContext {
  planName: string;
  /** The total the dialog read; sent back so a change in between is refused. */
  total: number;
  used: number;
  booked: number;
  refusal: string | null;
}

/** The Card's counts in the queue today; refusal says why it cannot be adjusted. */
function countsOf(ctx: PlanContext, today: string): { used: number; booked: number; refusal: string | null } {
  const refused = (refusal: string) => ({ used: 0, booked: 0, refusal });
  if (ctx.plan.sessionsTotal === null) return refused("למסלול לפי זמן אין יתרת אימונים");
  if (ctx.plan.status !== "active" || ctx.plan.ended_on) return refused("המסלול הסתיים או בוטל");
  // Outside the queue (an Add-on) nothing counts its sessions; a 0 here would erase what was used.
  const entry = resolvePlanQueue(ctx.plans, ctx.rows, today).plans.find((e) => e.plan.id === ctx.plan.id);
  if (!entry) return refused("למסלול הזה אין יתרת אימונים לתיקון");
  return { used: entry.used, booked: entry.booked, refusal: null };
}

/** What the Adjustment dialog needs. Admins and Branch managers of the Plan's branch. */
export async function getAdjustmentContextAction(planId: string): Promise<AdjustmentContext | { error: string }> {
  if (!isValidUUID(planId)) return { error: "מזהה לא תקין" };
  const ctx = await loadPlanContext(createAdminClient(), planId, { withOrder: false });
  if ("error" in ctx) return ctx;
  return {
    planName: ctx.plan.product?.name_he ?? "מסלול",
    total: ctx.plan.sessionsTotal ?? 0,
    ...countsOf(ctx, israelToday()),
  };
}

/**
 * An Adjustment: the Card is set to the balance staff typed. Used sessions
 * are recounted here; the change is applied by adjust_plan_sessions under the
 * per-trainee lock, only if the total is still the one staff saw, and lands on
 * the audit trail. Bookings beyond a lowered balance follow the shrink rule.
 */
export async function adjustSessionsAction(
  input: AdjustSessionsInput,
): Promise<{ ok: true; cancelledCount: number } | { error: string }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = adjustSessionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const ctx = await loadPlanContext(db, data.planId, { withOrder: false });
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const counts = countsOf(ctx, today);
  if (counts.refusal) return { error: counts.refusal };
  if (ctx.plan.sessionsTotal !== data.expectedTotal) return { error: BALANCE_CHANGED };

  const plan = planAdjustment({ total: data.expectedTotal, used: counts.used, booked: counts.booked }, data.target);
  if (!plan.ok) return { error: plan.error };

  const { error } = await db.rpc("adjust_plan_sessions", {
    p_plan_id: data.planId,
    p_expected_total: data.expectedTotal,
    p_new_total: plan.totalAfter,
    p_used: counts.used,
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_reason: data.reason,
    p_actor: user!.id,
  });
  if (error) {
    if (error.message.includes("balance_changed")) return { error: BALANCE_CHANGED };
    if (error.message.includes("roster_changed")) return { error: STALE_READ };
    if (error.message.includes("plan_not_live")) return { error: "המסלול הסתיים או בוטל" };
    console.error("[adjust] rpc failed:", error.message);
    return { error: "תיקון היתרה נכשל. נסו שוב." };
  }

  // Even a raise can hold a queued Plan of another branch past a Booking; the rule decides.
  const after = withPlanChange(ctx.plans, data.planId, { sessionsTotal: plan.totalAfter });
  const { cancelledCount } = await applyShrinkAfter(db, ctx, after, today);
  return { ok: true, cancelledCount };
}
