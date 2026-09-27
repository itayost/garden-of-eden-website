/**
 * The nightly Arbox purchase import: read both sides, plan with the pure
 * planner, apply one purchase at a time. Spec:
 * docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md
 *
 * No "server-only": scripts/import-arbox-purchases.ts runs this under tsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchArboxPurchases } from "@/lib/arbox/purchases";
import type { UnmatchedCard } from "@/lib/arbox/purchase-rows";
import {
  newPlanId,
  planArboxImports,
  type CreatePlanAction,
  type ImportAction,
  type ImportOrderDraft,
  type ImportPlanRow,
  type ImportProducts,
  type ImportSkip,
  type ImportSkipReason,
  type ImportTrainee,
  type MergePlanAction,
} from "@/lib/plans/arbox-import-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import type { Database } from "@/types/database";
import type { PlanKind } from "@/types/plans";

type Db = SupabaseClient<Database>;

/** Same literal as KIRYAT_ATA_BRANCH_NAME in enrollment/lib/catalog.ts, which is server-only. */
const KIRYAT_ATA = "קריית אתא";
const PRODUCT_SLUGS = { card10: "card_10", card20: "card_20", monthly: "monthly", term: "term_4_months" } as const;

interface OurSide {
  readonly branchId: string;
  readonly trainees: ImportTrainee[];
  readonly plans: ImportPlanRow[];
  readonly importedKeys: Set<string>;
  readonly products: ImportProducts;
}

async function loadBranchId(db: Db): Promise<string> {
  const { data, error } = await db.from("branches").select("id").eq("name_he", KIRYAT_ATA).single();
  if (error || !data) throw new Error(`[arbox-import] branch ${KIRYAT_ATA} not found: ${error?.message}`);
  return data.id;
}

async function loadTrainees(db: Db, branchId: string): Promise<ImportTrainee[]> {
  const { data: links, error: linkError } = await db.from("profile_branches").select("profile_id").eq("branch_id", branchId);
  if (linkError) throw new Error(`[arbox-import] branch members: ${linkError.message}`);
  const ids = (links ?? []).map((l) => l.profile_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, birthdate, phone, guardian_name, arbox_user_id")
    .in("id", ids)
    .eq("role", "trainee")
    .is("deleted_at", null)
    .not("arbox_user_id", "is", null);
  if (error) throw new Error(`[arbox-import] trainees: ${error.message}`);
  return (data ?? []).map((p) => ({
    profileId: p.id,
    arboxUserId: Number(p.arbox_user_id),
    name: p.full_name ?? "מתאמן",
    birthdate: p.birthdate,
    phone: p.phone,
    guardianName: p.guardian_name,
  }));
}

async function loadPlans(db: Db, profileIds: readonly string[]): Promise<ImportPlanRow[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = await db
    .from("trainee_plans")
    .select("id, profile_id, starts_on, ends_on, sessions_total, status, created_at, product:plan_products(kind), order:orders(payment_method, provider_transaction_id)")
    .in("profile_id", [...profileIds]);
  if (error) throw new Error(`[arbox-import] plans: ${error.message}`);
  type Row = {
    id: string; profile_id: string; starts_on: string; ends_on: string; sessions_total: number | null;
    status: string; created_at: string;
    product: { kind: string } | null;
    order: { payment_method: string | null; provider_transaction_id: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    productKind: (r.product?.kind ?? "addon") as PlanKind,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    sessionsTotal: r.sessions_total,
    status: r.status === "cancelled" ? "cancelled" : "active",
    createdOn: israelToday(new Date(r.created_at)),
    orderPaymentMethod: r.order?.payment_method ?? null,
    orderProviderTransactionId: r.order?.provider_transaction_id ?? null,
  }));
}

async function loadImportedKeys(db: Db): Promise<Set<string>> {
  const { data, error } = await db
    .from("orders")
    .select("provider_transaction_id")
    .eq("payment_provider", "manual")
    .like("provider_transaction_id", "arbox:%");
  if (error) throw new Error(`[arbox-import] imported keys: ${error.message}`);
  return new Set((data ?? []).map((o) => o.provider_transaction_id).filter((k): k is string => k !== null));
}

async function loadProducts(db: Db, branchId: string): Promise<ImportProducts> {
  const { data, error } = await db
    .from("plan_products")
    .select("id, slug")
    .eq("branch_id", branchId)
    .in("slug", Object.values(PRODUCT_SLUGS));
  if (error) throw new Error(`[arbox-import] products: ${error.message}`);
  const bySlug = new Map((data ?? []).map((p) => [p.slug, p.id]));
  const pick = (slug: string): string => {
    const id = bySlug.get(slug);
    if (!id) throw new Error(`[arbox-import] product ${slug} missing in ${KIRYAT_ATA}`);
    return id;
  };
  return {
    card10: pick(PRODUCT_SLUGS.card10),
    card20: pick(PRODUCT_SLUGS.card20),
    monthly: pick(PRODUCT_SLUGS.monthly),
    term: pick(PRODUCT_SLUGS.term),
  };
}

async function loadOurSide(db: Db): Promise<OurSide> {
  const branchId = await loadBranchId(db);
  const trainees = await loadTrainees(db, branchId);
  const [plans, importedKeys, products] = await Promise.all([
    loadPlans(db, trainees.map((t) => t.profileId)),
    loadImportedKeys(db),
    loadProducts(db, branchId),
  ]);
  return { branchId, trainees, plans, importedKeys, products };
}

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
      fulfilled_at: now,
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
    .update({ sessions_total: a.set.sessionsTotal, ends_on: a.set.endsOn, ...clears })
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
  }
  return targetId;
}

export interface ImportRunResult {
  readonly dryRun: boolean;
  readonly purchases: number;
  readonly unmatchedCards: number;
  readonly created: number;
  readonly merged: number;
  readonly alreadyImported: number;
  readonly failed: number;
  readonly skipped: Partial<Record<ImportSkipReason, number>>;
  readonly touchedProfileIds: string[];
}

type Outcome = "created" | "merged" | "alreadyImported" | "failed";

async function applyOne(
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
  await logGrant(db, a, order.id, planId);
  return a.type === "create" ? "created" : "merged";
}

function countSkips(skips: readonly ImportSkip[]): Partial<Record<ImportSkipReason, number>> {
  return skips.reduce<Partial<Record<ImportSkipReason, number>>>(
    (acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] ?? 0) + 1 }),
    {},
  );
}

export async function runArboxPurchaseImport(opts: { dryRun: boolean; now?: Date }): Promise<{
  result: ImportRunResult;
  actions: ImportAction[];
  skips: ImportSkip[];
  unmatchedCards: UnmatchedCard[];
  traineeNames: Map<string, string>;
}> {
  const now = opts.now ?? new Date();
  const db = createAdminClient() as Db;
  const { purchases, unmatchedCards } = await fetchArboxPurchases(now);
  const ours = await loadOurSide(db);
  const { actions, skips } = planArboxImports({
    today: israelToday(now),
    purchases,
    trainees: ours.trainees,
    plans: ours.plans,
    importedKeys: ours.importedKeys,
    products: ours.products,
  });
  const traineeNames = new Map(ours.trainees.map((t) => [t.profileId, t.name]));

  const realIds = new Map<string, string>();
  const resolve = (id: string): string | null => (id.startsWith(newPlanId("")) ? realIds.get(id) ?? null : id);
  const outcomes: Outcome[] = [];
  if (!opts.dryRun) {
    for (const a of actions) {
      outcomes.push(await applyOne(db, ours.branchId, a, resolve, (p, r) => realIds.set(p, r)));
    }
  }
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const touched = actions.filter((_, i) => outcomes[i] === "created" || outcomes[i] === "merged").map((a) => a.profileId);

  return {
    result: {
      dryRun: opts.dryRun,
      purchases: purchases.length,
      unmatchedCards: unmatchedCards.length,
      created: count("created"),
      merged: count("merged"),
      alreadyImported: count("alreadyImported"),
      failed: count("failed"),
      skipped: countSkips(skips),
      touchedProfileIds: [...new Set(touched)],
    },
    actions,
    skips,
    unmatchedCards,
    traineeNames,
  };
}
