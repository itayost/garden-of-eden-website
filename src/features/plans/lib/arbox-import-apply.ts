/**
 * The write half of the Arbox purchase import: one purchase at a time, order
 * first (it claims the key), then the plan, then the fulfilled stamp.
 *
 * No "server-only": scripts/import-arbox-purchases.ts runs this under tsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreatePlanAction,
  ImportAction,
  ImportOrderDraft,
  MergePlanAction,
} from "@/lib/plans/arbox-import-plan";
import type { Database } from "@/types/database";
import { daysBetween } from "@/lib/utils/iso-date";

export type Db = SupabaseClient<Database>;

type InsertOrderResult = { id: string } | "duplicate" | "failed";

async function insertOrder(db: Db, branchId: string, o: ImportOrderDraft): Promise<InsertOrderResult> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("orders")
    .insert({
      product_id: o.productId,
      branch_id: branchId,
      status: "paid",
      paid_at: now,
      // Stamped only once the plan write lands; an unstamped import order is
      // a leftover that the next run repairs (healLeftoverOrders).
      fulfilled_at: null,
      payment_provider: "manual",
      payment_method: "arbox",
      provider_transaction_id: o.key,
      reference: o.reference,
      received_by: null,
      amount_ils: o.amountIls,
      parent_name: o.parentName,
      payer_phone: o.phone,
      login_phone: o.phone,
      child_name: o.childName,
      child_birthdate: o.childBirthdate,
      email: null,
      profile_id: o.profileId,
      installments: 1,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return "duplicate";
  if (error || !data) {
    console.error(`[arbox-import] order ${o.key} failed:`, error?.message);
    return "failed";
  }
  return { id: data.id };
}

async function markFulfilled(db: Db, orderId: string): Promise<void> {
  const { error } = await db.from("orders").update({ fulfilled_at: new Date().toISOString() }).eq("id", orderId);
  if (error) console.error(`[arbox-import] stamping order ${orderId} failed:`, error.message);
}

/**
 * Import orders the last run left unstamped: the order landed but the run
 * died or failed before (or while) writing the plan. One with a plan is
 * finished and gets its stamp; one without is deleted so the purchase is
 * retried. If such an order was a merge that did land, the retry fails the
 * merge guard every night rather than adding the sessions twice.
 */
export async function healLeftoverOrders(db: Db): Promise<number> {
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("payment_provider", "manual")
    .like("provider_transaction_id", "arbox:%")
    .is("fulfilled_at", null);
  if (error) throw new Error(`[arbox-import] leftover orders: ${error.message}`);
  const ids = (data ?? []).map((o) => o.id);
  for (const id of ids) {
    const { data: plan } = await db.from("trainee_plans").select("id").eq("order_id", id).maybeSingle();
    if (plan) await markFulfilled(db, id);
    else await deleteOrder(db, id);
  }
  return ids.length;
}

async function deleteOrder(db: Db, orderId: string): Promise<void> {
  const { error } = await db.from("orders").delete().eq("id", orderId);
  if (error) console.error(`[arbox-import] rollback of order ${orderId} failed:`, error.message);
}

async function logGrant(db: Db, a: ImportAction, orderId: string, planId: string): Promise<void> {
  const { error } = await db.from("activity_logs").insert({
    user_id: a.profileId,
    action: "plan_granted",
    actor_id: null,
    actor_name: "Arbox",
    metadata: { source: "arbox-import", type: a.type, orderId, planId, arboxMembershipUserId: a.purchase.membershipUserId },
  });
  if (error) console.error(`[arbox-import] activity log failed:`, error.message);
}

async function applyCreate(db: Db, branchId: string, a: CreatePlanAction, orderId: string): Promise<string | null> {
  const { data, error } = await db
    .from("trainee_plans")
    .insert({
      profile_id: a.profileId,
      product_id: a.plan.productId,
      branch_id: branchId,
      order_id: orderId,
      starts_on: a.plan.startsOn,
      ends_on: a.plan.endsOn,
      sessions_total: a.plan.sessionsTotal,
      // An Arbox purchase keeps the end date Arbox gave it (ADR-0008).
      not_before: a.plan.startsOn,
      duration_days: daysBetween(a.plan.startsOn, a.plan.endsOn) + 1,
      fixed_ends_on: a.plan.endsOn,
      status: "active",
      source: "manual",
      note: a.plan.note,
      created_by: null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[arbox-import] plan for ${a.order.key} failed:`, error?.message);
    return null;
  }
  return data.id;
}

async function applyMerge(db: Db, a: MergePlanAction, targetId: string, resolve: (id: string) => string | null): Promise<string | null> {
  const clears = {
    ...(a.set.clearThreeDays ? { reminded_3_days_at: null } : {}),
    ...(a.set.clearLastSession ? { reminded_last_session_at: null } : {}),
    ...(a.set.clearExpired ? { reminded_expired_at: null } : {}),
  };
  const base = db
    .from("trainee_plans")
    .update({ sessions_total: a.set.sessionsTotal, ends_on: a.set.endsOn, fixed_ends_on: a.set.endsOn, ...clears })
    .eq("id", targetId)
    .eq("ends_on", a.target.expectEndsOn);
  // Guarded by the values the plan was read with: a staff edit in between
  // makes this match nothing, and the purchase retries next night.
  const guarded = a.target.expectSessionsTotal === null
    ? base.is("sessions_total", null)
    : base.eq("sessions_total", a.target.expectSessionsTotal);
  const { data, error } = await guarded.select("id");
  if (error || (data ?? []).length === 0) {
    console.error(`[arbox-import] merge of ${a.order.key} into ${targetId} failed:`, error?.message ?? "plan changed");
    return null;
  }
  for (const shift of a.shifts) {
    const planId = resolve(shift.planId);
    if (!planId) continue;
    const { error: shiftError } = await db
      .from("trainee_plans")
      .update({ starts_on: shift.startsOn, ends_on: shift.endsOn })
      .eq("id", planId)
      .eq("starts_on", shift.expectStartsOn);
    if (shiftError) console.error(`[arbox-import] moving queued plan ${planId} failed:`, shiftError.message);
    // The queue reads a fixed end, not ends_on: move it too, or the shifted
    // Plan would start after its own end and never run.
    const { error: fixedError } = await db
      .from("trainee_plans")
      .update({ fixed_ends_on: shift.endsOn })
      .eq("id", planId)
      .not("fixed_ends_on", "is", null);
    if (fixedError) console.error(`[arbox-import] moving the fixed end of ${planId} failed:`, fixedError.message);
  }
  return targetId;
}

export type Outcome = "created" | "merged" | "alreadyImported" | "failed";

export async function applyOne(
  db: Db,
  branchId: string,
  a: ImportAction,
  resolve: (id: string) => string | null,
  remember: (placeholder: string, realId: string) => void,
): Promise<Outcome> {
  const targetId = a.type === "merge" ? resolve(a.target.planId) : null;
  if (a.type === "merge" && !targetId) return "failed";

  const order = await insertOrder(db, branchId, a.order);
  if (order === "duplicate") return "alreadyImported";
  if (order === "failed") return "failed";

  const planId = a.type === "create"
    ? await applyCreate(db, branchId, a, order.id)
    : await applyMerge(db, a, targetId as string, resolve);
  if (!planId) {
    await deleteOrder(db, order.id);
    return "failed";
  }
  if (a.type === "create") remember(a.plan.id, planId);
  await markFulfilled(db, order.id);
  await logGrant(db, a, order.id, planId);
  return a.type === "create" ? "created" : "merged";
}
