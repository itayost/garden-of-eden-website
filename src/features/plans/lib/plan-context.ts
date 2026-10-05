import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import type { Database } from "@/types/database";
import type { QueueRow } from "@/lib/plans/plan-queue";
import type { Order } from "@/types/plans";
import { loadQueueRows, loadStoredPlans, type StoredPlan } from "./queries";

export type PlanOrder = Pick<
  Order,
  "id" | "status" | "amount_ils" | "payment_method" | "morning_document_url" | "paid_at" | "created_at"
>;

/** Everything an undo act (Void, Cancellation) reads about one Plan. */
export interface PlanContext {
  plan: StoredPlan;
  /** Every Plan of the same Trainee. */
  plans: StoredPlan[];
  rows: QueueRow[];
  order: PlanOrder | null;
}

/** A Bookings line for a confirmation. */
export interface AffectedBooking {
  date: string;
  /** HH:MM */
  time: string;
}

/** The Trainee's Plans with one of them as an undo act would leave it. */
export function withPlanChange(
  plans: readonly StoredPlan[],
  planId: string,
  change: Partial<Pick<StoredPlan, "status" | "endedOn" | "sessionsTotal" | "durationDays" | "fixedEndsOn" | "freezes">>,
): StoredPlan[] {
  return plans.map((p) => (p.id === planId ? { ...p, ...change } : p));
}

/** What staff read changed before the write: a dialog older than the Plan, or a Booking or sale in between. */
export const STALE_READ = "הנתונים השתנו בינתיים. רעננו ונסו שוב.";

/** The Hebrew for an adjust function's refusal, or null for an unexpected error. */
export function guardRefusal(message: string): string | null {
  if (message.includes("plan_not_live")) return "המסלול הסתיים או בוטל";
  if (message.includes("roster_changed") || message.includes("plans_changed")) return STALE_READ;
  return null;
}

export const toBooking = (row: Pick<QueueRow, "schedule_date" | "start_time">): AffectedBooking => ({
  date: row.schedule_date,
  time: row.start_time.slice(0, 5),
});

/**
 * The Plan, its Trainee's whole queue and roster, and its order, after the
 * check that the caller is an Admin or a Branch manager of the Plan's branch.
 */
export async function loadPlanContext(
  db: SupabaseClient<Database>,
  planId: string,
  options: { withOrder?: boolean } = {},
): Promise<PlanContext | { error: string }> {
  const withOrder = options.withOrder ?? true;
  const { data: head } = await db.from("trainee_plans").select("profile_id, branch_id").eq("id", planId).maybeSingle();
  if (!head) return { error: "המסלול לא נמצא" };
  const denied = await verifyAdminOrBranchManager([head.branch_id]);
  if (denied) return { error: denied };

  const [plansByProfile, rowsByProfile] = await Promise.all([
    loadStoredPlans(db, [head.profile_id]),
    loadQueueRows(db, [head.profile_id]),
  ]);
  const plans = plansByProfile.get(head.profile_id) ?? [];
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return { error: "המסלול לא נמצא" };

  const { data: order } = withOrder && plan.order_id
    ? await db
        .from("orders")
        .select("id, status, amount_ils, payment_method, morning_document_url, paid_at, created_at")
        .eq("id", plan.order_id)
        .maybeSingle()
    : { data: null };
  return { plan, plans, rows: rowsByProfile.get(head.profile_id) ?? [], order: order as PlanOrder | null };
}
