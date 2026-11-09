import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import {
  LANDING_BRANCHES,
  landingBranchByName,
  type JoinBranchOption,
  type LandingBranch,
  type LandingBranchKey,
} from "@/lib/branches/landing-branches";
import type { Database } from "@/types/database";
import type { PlanProduct } from "@/types/plans";

export const KIRYAT_ATA_BRANCH_NAME = "קריית אתא";

type ProductRow = Database["public"]["Tables"]["plan_products"]["Row"];

const toProduct = (row: ProductRow): PlanProduct =>
  ({ ...row, price_ils: Number(row.price_ils) }) as PlanProduct;

/**
 * The active products of these branches, in display order, by branch.
 * Throws on a failed read: an empty catalog must mean nothing is on sale.
 *
 * Admin client on public pages: /join and the landing pages render on the
 * server with no session. The catalog policy allows anon reads too.
 */
async function loadCatalogs(db: SupabaseClient<Database>, branchIds: readonly string[]): Promise<Map<string, PlanProduct[]>> {
  if (branchIds.length === 0) return new Map();
  const { data, error } = await db
    .from("plan_products")
    .select("*")
    .in("branch_id", [...branchIds])
    .eq("is_active", true)
    .order("order_index");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return new Map(branchIds.map((id) => [id, rows.filter((r) => r.branch_id === id).map(toProduct)]));
}

/** The landing branches that exist and are active, in landing order, keyed by their row id. */
async function loadLandingBranchRows(db: SupabaseClient<Database>): Promise<(LandingBranch & { id: string })[]> {
  const { data, error } = await db
    .from("branches")
    .select("id, name_he")
    .in("name_he", LANDING_BRANCHES.map((b) => b.nameHe))
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return LANDING_BRANCHES.flatMap((branch) => {
    const row = (data ?? []).find((r) => r.name_he === branch.nameHe);
    return row ? [{ ...branch, id: row.id }] : [];
  });
}

/** One landing page's price list: the branch's active products. Empty on any failure. */
export async function loadLandingCatalog(key: LandingBranchKey): Promise<PlanProduct[]> {
  try {
    const db = createAdminClient();
    const branch = (await loadLandingBranchRows(db)).find((b) => b.key === key);
    if (!branch) return [];
    return (await loadCatalogs(db, [branch.id])).get(branch.id) ?? [];
  } catch (error) {
    console.error(`[catalog] ${key} landing catalog failed:`, error);
    return [];
  }
}

export interface JoinCatalog {
  branches: JoinBranchOption[];
  /** Each branch's active products, by branch id. */
  catalogs: Map<string, PlanProduct[]>;
}

/** Every landing branch with its catalog, for /join to pick from. Empty on any failure. */
export async function loadJoinCatalog(): Promise<JoinCatalog> {
  try {
    const db = createAdminClient();
    const rows = await loadLandingBranchRows(db);
    const catalogs = await loadCatalogs(db, rows.map((r) => r.id));
    const branches = rows.map((r) => ({ ...r, sells: (catalogs.get(r.id)?.length ?? 0) > 0 }));
    return { branches, catalogs };
  } catch (error) {
    console.error("[catalog] join catalog failed:", error);
    return { branches: [], catalogs: new Map() };
  }
}

/** The landing branch a branch row is, or null for a branch without a landing page. */
export async function landingBranchOf(db: SupabaseClient, branchId: string | null): Promise<LandingBranch | null> {
  if (!branchId) return null;
  const { data } = await db.from("branches").select("name_he").eq("id", branchId).maybeSingle();
  return landingBranchByName((data as { name_he: string } | null)?.name_he);
}

/** The landing branch an order was sold at, for the pages that only have its id. */
export async function landingBranchOfOrder(orderId: string | undefined): Promise<LandingBranch | null> {
  if (!orderId || !isValidUUID(orderId)) return null;
  const db = createAdminClient();
  const { data } = await db.from("orders").select("branch_id").eq("id", orderId).maybeSingle();
  return landingBranchOf(db, data?.branch_id ?? null);
}

export async function loadProductById(productId: string): Promise<PlanProduct | null> {
  const { data } = (await typedFrom(createAdminClient(), "plan_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle()) as { data: PlanProduct | null };
  return data ? { ...data, price_ils: Number(data.price_ils) } : null;
}
