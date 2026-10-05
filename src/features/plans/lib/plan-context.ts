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
): Promise<PlanContext | { error: string }> {
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

  const { data: order } = plan.order_id
    ? await db
        .from("orders")
        .select("id, status, amount_ils, payment_method, morning_document_url, paid_at, created_at")
        .eq("id", plan.order_id)
        .maybeSingle()
    : { data: null };
  return { plan, plans, rows: rowsByProfile.get(head.profile_id) ?? [], order: order as PlanOrder | null };
}
