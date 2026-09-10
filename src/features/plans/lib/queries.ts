import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { countSessionsUsedFromRows, resolvePlanStatus } from "@/lib/plans/plan-status";
import type { PlanProduct, PlanStatus, TraineePlan } from "@/types/plans";

export interface PlanWithUsage {
  plan: TraineePlan;
  product: Pick<PlanProduct, "name_he" | "kind">;
  sessionsUsed: number;
  status: PlanStatus;
}

type PlanRow = TraineePlan & { product: Pick<PlanProduct, "name_he" | "kind"> | null };

interface RosterRow {
  trainee_id: string;
  slot: { schedule_date: string; branch_id: string | null } | null;
}

/**
 * Roster rows for these trainees in one query. PostgREST embeds the slot so
 * the date and branch come along; the window filter is applied in memory per
 * plan because each plan has its own window.
 */
async function loadRosterRows(
  db: SupabaseClient,
  profileIds: readonly string[],
): Promise<RosterRow[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = (await typedFrom(db, "daily_schedule_slot_trainees")
    .select("trainee_id, slot:daily_schedule_slots!inner(schedule_date, branch_id)")
    .in("trainee_id", [...profileIds])) as {
    data: RosterRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("loadRosterRows error:", error);
    return [];
  }
  return data ?? [];
}

/** Active first, then the one ending last: the plan that matters right now. */
function pickRelevant(plans: readonly PlanRow[]): PlanRow | null {
  const active = plans.filter((p) => p.status === "active");
  const pool = active.length > 0 ? active : plans;
  return [...pool].sort((a, b) => (a.ends_on < b.ends_on ? 1 : -1))[0] ?? null;
}

export function toPlanWithUsage(
  row: PlanRow,
  rosterRows: readonly RosterRow[],
  today: string,
): PlanWithUsage {
  const rows = rosterRows
    .filter((r) => r.trainee_id === row.profile_id && r.slot)
    .map((r) => ({ schedule_date: r.slot!.schedule_date, branch_id: r.slot!.branch_id }));
  const sessionsUsed = countSessionsUsedFromRows(rows, row, today);
  return {
    plan: row,
    product: row.product ?? { name_he: "מסלול", kind: "subscription" },
    sessionsUsed,
    status: resolvePlanStatus(row, sessionsUsed, today),
  };
}

/**
 * The plan to show for each profile, with its usage and derived status.
 *
 * Takes the service-role client: trainee_plans is readable by its owner, but
 * the roster tables are staff-only, so the usage count needs the admin client
 * for everyone. Callers gate on the session first.
 */
export async function loadPlansWithUsage(
  db: SupabaseClient,
  profileIds: readonly string[],
  today: string,
): Promise<Map<string, PlanWithUsage>> {
  const result = new Map<string, PlanWithUsage>();
  if (profileIds.length === 0) return result;

  const { data, error } = (await typedFrom(db, "trainee_plans")
    .select("*, product:plan_products(name_he, kind)")
    .in("profile_id", [...profileIds])) as {
    data: PlanRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("loadPlansWithUsage error:", error);
    return result;
  }

  const byProfile = new Map<string, PlanRow[]>();
  for (const row of data ?? []) {
    byProfile.set(row.profile_id, [...(byProfile.get(row.profile_id) ?? []), row]);
  }

  const rosterRows = await loadRosterRows(db, [...byProfile.keys()]);
  for (const [profileId, plans] of byProfile) {
    const relevant = pickRelevant(plans);
    if (relevant) result.set(profileId, toPlanWithUsage(relevant, rosterRows, today));
  }
  return result;
}

/**
 * The signed-in trainee's own plan. The user client proves who is asking;
 * the admin client does the read because the roster tables are staff-only.
 */
export async function loadOwnPlanWithUsage(today: string): Promise<PlanWithUsage | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const map = await loadPlansWithUsage(createAdminClient(), [user.id], today);
  return map.get(user.id) ?? null;
}
