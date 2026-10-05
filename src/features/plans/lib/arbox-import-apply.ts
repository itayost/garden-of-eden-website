/**
 * The write half of the Arbox purchase import: one purchase at a time, order
 * first (it claims the key), then the plan, then the fulfilled stamp.
 *
 * No "server-only": scripts/import-arbox-purchases.ts runs this under tsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportAction, ImportOrderDraft } from "@/lib/plans/arbox-import-plan";
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
 * retried.
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

/** A new Plan at the end of the Trainee's Plan queue, on Arbox's terms (ADR-0008). */
async function applyCreate(db: Db, branchId: string, a: ImportAction, orderId: string): Promise<string | null> {
  const { plan } = a;
  const { data, error } = await db
    .from("trainee_plans")
    .insert({
      profile_id: a.profileId,
      product_id: plan.productId,
      branch_id: branchId,
      order_id: orderId,
      // The forecast window; a Plan queued past Arbox's end still needs one.
      starts_on: plan.startsOn,
      ends_on: plan.fixedEndsOn < plan.startsOn ? plan.startsOn : plan.fixedEndsOn,
      sessions_total: plan.sessionsTotal,
      not_before: plan.notBefore,
      duration_days: daysBetween(plan.notBefore, plan.fixedEndsOn) + 1,
      fixed_ends_on: plan.fixedEndsOn,
      status: "active",
      source: "manual",
      note: plan.note,
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

export type Outcome = "created" | "alreadyImported" | "failed";

export async function applyOne(db: Db, branchId: string, a: ImportAction): Promise<Outcome> {
  const order = await insertOrder(db, branchId, a.order);
  if (order === "duplicate") return "alreadyImported";
  if (order === "failed") return "failed";

  const planId = await applyCreate(db, branchId, a, order.id);
  if (!planId) {
    await deleteOrder(db, order.id);
    return "failed";
  }
  await markFulfilled(db, order.id);
  await logGrant(db, a, order.id, planId);
  return "created";
}
