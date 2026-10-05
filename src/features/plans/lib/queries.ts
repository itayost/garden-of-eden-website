import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  planStart,
  resolvePlanQueue,
  type PlanInQueue,
  type PlanStart,
  type PlanQueue,
  type QueuePlan,
  type QueueRow,
} from "@/lib/plans/plan-queue";
import { PLAN_FREEZES_EMBED, toQueuePlan, type PlanFreezeRow } from "@/lib/plans/queue-plan-row";
import type { PlanProduct, PlanStatus, TraineePlan } from "@/types/plans";

type ProductBits = Pick<PlanProduct, "name_he" | "kind">;

/** A stored Plan with its product and its sale-time terms in the queue's shape. */
export type StoredPlan = TraineePlan & { product: ProductBits | null } & QueuePlan & {
  /** Its order was paid in Arbox: it renews there. */
  paidInArbox: boolean;
};

/** The Plan stamps a guarded function compares with the trainee's (assert_trainee_unchanged). */
export const planStamps = (plans: readonly Pick<StoredPlan, "updated_at">[]): string[] => plans.map((p) => p.updated_at);

/** What every screen shows for one Trainee, all from the one Plan queue. */
export interface PlanQueueView {
  queue: PlanQueue<StoredPlan>;
  /** The Plan to name: current, else next, else the last that ended. */
  shown: PlanInQueue<StoredPlan>;
  /** shown.plan, the stored row. */
  plan: StoredPlan;
  product: ProductBits;
  status: PlanStatus;
  /** Sessions left on the whole queue; null when it holds no Card. */
  sessionsLeft: number | null;
  /** The last day of the queue. */
  endsOn: string;
}

const FALLBACK_PRODUCT: ProductBits = { name_he: "מסלול", kind: "subscription" };

/** Every Plan of these Trainees with its product, grouped by Trainee. */
export async function loadStoredPlans(
  db: SupabaseClient,
  profileIds: readonly string[],
): Promise<Map<string, StoredPlan[]>> {
  const result = new Map<string, StoredPlan[]>();
  if (profileIds.length === 0) return result;
  const { data, error } = (await typedFrom(db, "trainee_plans")
    .select(
      `*, product:plan_products(name_he, kind), order:orders!trainee_plans_order_id_fkey(payment_method), ${PLAN_FREEZES_EMBED}`,
    )
    .in("profile_id", [...profileIds])) as {
    data:
      | (TraineePlan & {
          product: ProductBits | null;
          order: { payment_method: string | null } | null;
          plan_freezes: PlanFreezeRow[] | null;
        })[]
      | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("loadStoredPlans error:", error);
    return result;
  }
  for (const { order, ...row } of data ?? []) {
    const stored: StoredPlan = { ...toQueuePlan(row), paidInArbox: order?.payment_method === "arbox" };
    result.set(row.profile_id, [...(result.get(row.profile_id) ?? []), stored]);
  }
  return result;
}

interface RosterRow {
  id: string;
  trainee_id: string;
  cancelled_at: string | null;
  late_cancel: boolean;
  slot: { schedule_date: string; start_time: string; branch_id: string | null; called_off_at: string | null } | null;
}

const PAGE = 1000;

/**
 * Roster rows of these Trainees, grouped by Trainee, page by page: PostgREST
 * caps a response at 1000 rows, and a silently truncated roster would
 * undercount every queue.
 */
export async function loadQueueRows(
  db: SupabaseClient,
  profileIds: readonly string[],
): Promise<Map<string, QueueRow[]>> {
  const result = new Map<string, QueueRow[]>();
  if (profileIds.length === 0) return result;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = (await typedFrom(db, "daily_schedule_slot_trainees")
      .select(
        "id, trainee_id, cancelled_at, late_cancel, slot:daily_schedule_slots!inner(schedule_date, start_time, branch_id, called_off_at)",
      )
      .in("trainee_id", [...profileIds])
      .order("id")
      .range(from, from + PAGE - 1)) as {
      data: RosterRow[] | null;
      error: { message: string } | null;
    };
    if (error) {
      console.error("loadQueueRows error:", error);
      return result;
    }
    for (const row of data ?? []) {
      if (!row.slot) continue;
      const queueRow: QueueRow = {
        id: row.id,
        schedule_date: row.slot.schedule_date,
        start_time: row.slot.start_time,
        branch_id: row.slot.branch_id,
        cancelled_at: row.cancelled_at,
        late_cancel: row.late_cancel,
        called_off: row.slot.called_off_at !== null,
      };
      result.set(row.trainee_id, [...(result.get(row.trainee_id) ?? []), queueRow]);
    }
    if ((data ?? []).length < PAGE) return result;
  }
}

/** The screen view of one resolved queue; null when there is nothing to show. */
export function toPlanQueueView(queue: PlanQueue<StoredPlan>): PlanQueueView | null {
  if (!queue.shown || !queue.status || !queue.endsOn) return null;
  return {
    queue,
    shown: queue.shown,
    plan: queue.shown.plan,
    product: queue.shown.plan.product ?? FALLBACK_PRODUCT,
    status: queue.status,
    sessionsLeft: queue.sessionsLeft,
    endsOn: queue.endsOn,
  };
}

/**
 * The Plan queue of each Trainee who has one.
 *
 * Takes the service-role client: trainee_plans is readable by its owner, but
 * the roster tables are staff-only, so the count needs the admin client for
 * everyone. Callers gate on the session first.
 */
export async function loadPlanQueues(
  db: SupabaseClient,
  profileIds: readonly string[],
  today: string,
): Promise<Map<string, PlanQueueView>> {
  const result = new Map<string, PlanQueueView>();
  const plans = await loadStoredPlans(db, profileIds);
  const rows = await loadQueueRows(db, [...plans.keys()]);
  for (const [profileId, own] of plans) {
    const view = toPlanQueueView(resolvePlanQueue(own, rows.get(profileId) ?? [], today));
    if (view) result.set(profileId, view);
  }
  return result;
}

/**
 * The signed-in Trainee's own queue. The user client proves who is asking;
 * the admin client does the read because the roster tables are staff-only.
 */
export async function loadOwnPlanQueue(today: string): Promise<PlanQueueView | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const map = await loadPlanQueues(createAdminClient(), [user.id], today);
  return map.get(user.id) ?? null;
}

/** Whether a Trainee has a Plan current or queued, so a new one waits behind it. */
export async function hasPlansAhead(db: SupabaseClient, profileId: string, today: string): Promise<boolean> {
  const [plans, rows] = await Promise.all([loadStoredPlans(db, [profileId]), loadQueueRows(db, [profileId])]);
  return resolvePlanQueue(plans.get(profileId) ?? [], rows.get(profileId) ?? [], today).ahead.length > 0;
}

/**
 * Where the Plan an order bought sits in its Trainee's queue: when it starts,
 * in a parent's words, and its own last day. Null when there is no such Plan.
 */
export async function loadPlanPlacement(
  db: SupabaseClient,
  profileId: string,
  orderId: string,
  today: string,
): Promise<{ start: PlanStart | null; endsOn: string } | null> {
  const [plans, rows] = await Promise.all([loadStoredPlans(db, [profileId]), loadQueueRows(db, [profileId])]);
  const own = plans.get(profileId) ?? [];
  const stored = own.find((p) => p.order_id === orderId);
  if (!stored) return null;
  const queue = resolvePlanQueue(own, rows.get(profileId) ?? [], today);
  const entry = queue.plans.find((e) => e.plan.id === stored.id);
  // An Add-on is outside the queue and keeps its stored window.
  return { start: planStart(queue, stored.id, today), endsOn: entry?.expiresOn ?? stored.ends_on };
}
