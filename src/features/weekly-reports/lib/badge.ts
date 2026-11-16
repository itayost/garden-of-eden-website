import "server-only";

import { unstable_cache } from "next/cache";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { WEEKLY_REPORTS_TAG } from "./cache-tags";
import { lastCompletedWeekStart } from "./report-week";

/**
 * Ten minutes. Every queue action and both jobs mark it stale through
 * revalidateWeeklyReports(), so an approval lowers it at once.
 */
const BADGE_SECONDS = 600;

/**
 * Pending reports of a Report week in a scope. The week and the sorted scope
 * ids are the arguments, so they are part of the cache key: two Trainers of
 * different branches never share a number. Null scope is an Admin's (all).
 */
const cachedPendingCount = unstable_cache(
  async (weekStart: string, scopeBranchIds: string[] | null): Promise<number> => {
    const base = createAdminClient()
      .from("weekly_reports")
      .select("id", { count: "exact", head: true })
      .eq("week_start", weekStart)
      .eq("status", "pending");
    const { count, error } = await (scopeBranchIds === null ? base : base.overlaps("branch_ids", scopeBranchIds));
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  ["weekly-reports-pending-count"],
  { revalidate: BADGE_SECONDS, tags: [WEEKLY_REPORTS_TAG] },
);

/**
 * The badge on דוחות שבועיים: the current Report week's reports waiting for
 * approval in the caller's branches. 0 on any failure, so the menu never breaks.
 */
export async function weeklyReportsBadgeCount(): Promise<number> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return 0;
  try {
    const scopeResult = await getBranchScopeAction();
    if ("error" in scopeResult) return 0;
    const { scope } = scopeResult.data;
    const scopeIds = scope.kind === "all" ? null : [...scope.ids].sort();
    if (scopeIds !== null && scopeIds.length === 0) return 0;
    return await cachedPendingCount(lastCompletedWeekStart(israelToday()), scopeIds);
  } catch (err) {
    console.error("weeklyReportsBadgeCount failed:", err);
    return 0;
  }
}
