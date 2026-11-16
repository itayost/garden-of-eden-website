/**
 * The weekly report setting of every branch that has one, through the service
 * role. A branch with no row is off.
 */
import "server-only";

import { readAllPages } from "@/lib/supabase/in-chunks";
import type { ReportMode, ReportSetting } from "../audience";
import { must, type Db } from "./read";

const MODES: readonly ReportMode[] = ["off", "approval", "automatic"];

function modeOf(value: string): ReportMode {
  const mode = MODES.find((known) => known === value);
  if (mode === undefined) {
    // The table's CHECK allows only the three; an unknown value is treated as off.
    console.error(`[weekly-reports] unknown weekly report mode "${value}", treated as off`);
    return "off";
  }
  return mode;
}

export async function loadReportSettings(db: Db): Promise<ReportSetting[]> {
  const rows = must(
    "weekly_report_settings",
    await readAllPages(() =>
      db.from("weekly_report_settings").select("branch_id, mode, birth_years, missed_you").order("branch_id"),
    ),
  );
  return rows.map((row) => ({
    branchId: row.branch_id,
    mode: modeOf(row.mode),
    birthYears: row.birth_years && row.birth_years.length > 0 ? [...row.birth_years] : null,
    missedYou: row.missed_you,
  }));
}
