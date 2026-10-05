/**
 * The nightly Arbox purchase import: read both sides, plan with the pure
 * planner, apply one purchase at a time. Spec:
 * docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md
 *
 * No "server-only": scripts/import-arbox-purchases.ts runs this under tsx.
 */
import { fetchArboxPurchases } from "@/lib/arbox/purchases";
import type { UnmatchedCard } from "@/lib/arbox/purchase-rows";
import {
  planArboxImports,
  type ImportAction,
  type ImportPlanRow,
  type ImportProducts,
  type ImportSkip,
  type ImportSkipReason,
  type ImportTrainee,
  purchaseKey,
} from "@/lib/plans/arbox-import-plan";
import type { QueueRow } from "@/lib/plans/plan-queue";
import { toQueuePlan } from "@/lib/plans/queue-plan-row";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyOne, healLeftoverOrders, type Db, type Outcome } from "./arbox-import-apply";
import { israelToday } from "@/lib/utils/tasks";
import type { PlanKind } from "@/types/plans";


/** Same literal as KIRYAT_ATA_BRANCH_NAME in enrollment/lib/catalog.ts, which is server-only. */
const KIRYAT_ATA = "קריית אתא";
const PRODUCT_SLUGS = { card10: "card_10", card20: "card_20", monthly: "monthly", term: "term_4_months" } as const;

interface OurSide {
  readonly branchId: string;
  readonly trainees: ImportTrainee[];
  readonly plans: ImportPlanRow[];
  readonly rows: Map<string, QueueRow[]>;
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

const PAGE = 1000;

interface RosterRow {
  readonly id: string;
  readonly trainee_id: string;
  readonly cancelled_at: string | null;
  readonly late_cancel: boolean;
  readonly slot: {
    readonly schedule_date: string;
    readonly start_time: string;
    readonly branch_id: string | null;
    readonly called_off_at: string | null;
  } | null;
}

/**
 * Roster rows from `since` on, page by page: PostgREST caps a response at
 * 1000 rows, and a silently truncated roster would undercount usage.
 */
async function loadRosterRows(db: Db, profileIds: readonly string[], since: string): Promise<RosterRow[]> {
  const pages: RosterRow[][] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("daily_schedule_slot_trainees")
      .select("id, trainee_id, cancelled_at, late_cancel, slot:daily_schedule_slots!inner(schedule_date, start_time, branch_id, called_off_at)")
      .in("trainee_id", [...profileIds])
      .gte("slot.schedule_date", since)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[arbox-import] rosters: ${error.message}`);
    const rows = (data ?? []) as unknown as RosterRow[];
    pages.push(rows);
    if (rows.length < PAGE) break;
  }
  return pages.flat();
}

interface StoredSide {
  readonly plans: ImportPlanRow[];
  readonly rows: Map<string, QueueRow[]>;
}

/** Every Plan of these Trainees in the queue's shape, and the roster rows the queue charges. */
async function loadPlans(db: Db, profileIds: readonly string[]): Promise<StoredSide> {
  if (profileIds.length === 0) return { plans: [], rows: new Map() };
  const { data, error } = await db
    .from("trainee_plans")
    .select("id, profile_id, branch_id, starts_on, ends_on, sessions_total, not_before, duration_days, fixed_ends_on, ended_on, status, created_at, product:plan_products(kind), order:orders!trainee_plans_order_id_fkey(payment_method, provider_transaction_id), plan_freezes(id, starts_on, ends_on)")
    .in("profile_id", [...profileIds]);
  if (error) throw new Error(`[arbox-import] plans: ${error.message}`);
  type Row = {
    id: string; profile_id: string; branch_id: string; starts_on: string; ends_on: string; sessions_total: number | null;
    not_before: string | null; duration_days: number | null; fixed_ends_on: string | null; ended_on: string | null;
    status: string; created_at: string;
    product: { kind: string } | null;
    plan_freezes: { id: string; starts_on: string; ends_on: string | null }[] | null;
    order: { payment_method: string | null; provider_transaction_id: string | null } | null;
  };
  const stored = (data ?? []) as unknown as Row[];
  const plans: ImportPlanRow[] = stored.map((r) => ({
    ...toQueuePlan({
      ...r,
      // A voided Plan was never sold; it must not come back as active here.
      status: r.status === "cancelled" || r.status === "voided" ? r.status : ("active" as const),
      product: { kind: (r.product?.kind ?? "addon") as PlanKind },
    }),
    profileId: r.profile_id,
    createdOn: israelToday(new Date(r.created_at)),
    orderPaymentMethod: r.order?.payment_method ?? null,
    orderProviderTransactionId: r.order?.provider_transaction_id ?? null,
  }));

  // The queue is walked from each Trainee's first Plan, so the rosters are
  // read from the earliest day any Plan may start.
  const since = plans.reduce<string | null>((acc, p) => (acc === null || p.notBefore < acc ? p.notBefore : acc), null);
  const roster = since === null ? [] : await loadRosterRows(db, profileIds, since);
  const rows = new Map<string, QueueRow[]>();
  for (const x of roster) {
    if (!x.slot) continue;
    const row: QueueRow = {
      id: x.id,
      schedule_date: x.slot.schedule_date,
      start_time: x.slot.start_time,
      branch_id: x.slot.branch_id,
      cancelled_at: x.cancelled_at,
      late_cancel: x.late_cancel,
      called_off: x.slot.called_off_at !== null,
    };
    rows.set(x.trainee_id, [...(rows.get(x.trainee_id) ?? []), row]);
  }
  return { plans, rows };
}

const KEY_CHUNK = 200;

/** Only the keys of today's Arbox purchases: bounded, unlike all imports ever. */
async function loadImportedKeys(db: Db, keys: readonly string[]): Promise<Set<string>> {
  const chunks = Array.from({ length: Math.ceil(keys.length / KEY_CHUNK) }, (_, i) => keys.slice(i * KEY_CHUNK, (i + 1) * KEY_CHUNK));
  const found = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await db
        .from("orders")
        .select("provider_transaction_id")
        .eq("payment_provider", "manual")
        .in("provider_transaction_id", chunk);
      if (error) throw new Error(`[arbox-import] imported keys: ${error.message}`);
      return (data ?? []).map((o) => o.provider_transaction_id).filter((k): k is string => k !== null);
    }),
  );
  return new Set(found.flat());
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

async function loadOurSide(db: Db, keys: readonly string[]): Promise<OurSide> {
  const branchId = await loadBranchId(db);
  const trainees = await loadTrainees(db, branchId);
  const [{ plans, rows }, importedKeys, products] = await Promise.all([
    loadPlans(db, trainees.map((t) => t.profileId)),
    loadImportedKeys(db, keys),
    loadProducts(db, branchId),
  ]);
  return { branchId, trainees, plans, rows, importedKeys, products };
}

export interface ImportRunResult {
  readonly dryRun: boolean;
  readonly purchases: number;
  readonly unmatchedCards: number;
  readonly created: number;
  /** Created Plans forecast to start after their own Arbox end, so they would never run. */
  readonly pastTheirEnd: number;
  readonly alreadyImported: number;
  readonly failed: number;
  /** Leftover import orders repaired or removed before planning. */
  readonly healed: number;
  readonly skipped: Partial<Record<ImportSkipReason, number>>;
  readonly touchedProfileIds: string[];
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
  const today = israelToday(now);
  const { purchases, unmatchedCards } = await fetchArboxPurchases(now);
  const healed = opts.dryRun ? 0 : await healLeftoverOrders(db);
  const ours = await loadOurSide(db, purchases.map(purchaseKey));
  const { actions, skips } = planArboxImports({
    today,
    branchId: ours.branchId,
    purchases,
    trainees: ours.trainees,
    plans: ours.plans,
    rows: ours.rows,
    importedKeys: ours.importedKeys,
    products: ours.products,
  });
  const traineeNames = new Map(ours.trainees.map((t) => [t.profileId, t.name]));

  const outcomes: Outcome[] = [];
  if (!opts.dryRun) {
    for (const a of actions) outcomes.push(await applyOne(db, ours.branchId, a));
  }
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const touched = actions.filter((_, i) => outcomes[i] === "created").map((a) => a.profileId);

  return {
    result: {
      dryRun: opts.dryRun,
      purchases: purchases.length,
      unmatchedCards: unmatchedCards.length,
      created: count("created"),
      pastTheirEnd: actions.filter((a, i) => outcomes[i] === "created" && a.neverRuns).length,
      alreadyImported: count("alreadyImported"),
      failed: count("failed"),
      healed,
      skipped: countSkips(skips),
      touchedProfileIds: [...new Set(touched)],
    },
    actions,
    skips,
    unmatchedCards,
    traineeNames,
  };
}
