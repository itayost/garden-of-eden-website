"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";

/** Until automatic mode opens (step 4) the card offers these two. */
export type CardMode = "off" | "approval";

export interface BranchReportSetting {
  branchId: string;
  branchName: string;
  mode: CardMode;
  /** Empty means every year. */
  birthYears: number[];
  missedYou: boolean;
  changedByName: string | null;
  /** Null when the branch has no row yet: it is off by default. */
  changedAt: string | null;
}

type SettingsResult = { success: true; data: BranchReportSetting[] } | { error: string };

/**
 * Every active branch with its weekly report setting, or the default (off,
 * every year, no "התגעגענו") when it has none. Admins only. A stored
 * `automatic` reads as approval, which is how the jobs treat it for now.
 */
export async function listReportSettingsAction(): Promise<SettingsResult> {
  const { error } = await verifyAdmin();
  if (error) return { error };
  const db = createAdminClient();
  const [branches, settings] = await Promise.all([
    db.from("branches").select("id, name_he").eq("is_active", true).order("order_index"),
    db
      .from("weekly_report_settings")
      .select("branch_id, mode, birth_years, missed_you, changed_at, changer:profiles!weekly_report_settings_changed_by_fkey(full_name)"),
  ]);
  if (branches.error || settings.error) {
    console.error("[weekly-reports] settings read failed:", branches.error?.message ?? settings.error?.message);
    return { error: "שגיאה בטעינת ההגדרות" };
  }
  const byBranch = new Map((settings.data ?? []).map((row) => [row.branch_id, row]));
  return {
    success: true,
    data: (branches.data ?? []).map((branch) => {
      const row = byBranch.get(branch.id);
      return {
        branchId: branch.id,
        branchName: branch.name_he,
        mode: row && row.mode !== "off" ? "approval" : "off",
        birthYears: [...(row?.birth_years ?? [])].sort((a, b) => a - b),
        missedYou: row?.missed_you ?? false,
        changedByName: row?.changer?.full_name?.trim() || null,
        changedAt: row?.changed_at ?? null,
      };
    }),
  };
}
