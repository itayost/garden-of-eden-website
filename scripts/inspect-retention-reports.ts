/**
 * READ-ONLY: list retention_reports rows with their entry counts and
 * created_at (overwrite timestamps). Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-retention-reports.ts
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";

interface ReportRow {
  report_month: string;
  created_at: string;
  data: {
    monthly?: unknown[];
    pro?: unknown[];
    training_card?: unknown[];
  } | null;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("retention_reports")
    .select("report_month, created_at, data")
    .order("report_month", { ascending: false });

  if (error) {
    console.error("select error:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as ReportRow[];
  console.log(`retention_reports rows: ${rows.length}\n`);
  console.log("month       | monthly | pro | card | created_at (overwrite time)");
  console.log("------------|---------|-----|------|----------------------------");
  for (const r of rows) {
    const m = r.data?.monthly?.length ?? 0;
    const p = r.data?.pro?.length ?? 0;
    const c = r.data?.training_card?.length ?? 0;
    console.log(
      `${r.report_month} | ${String(m).padStart(7)} | ${String(p).padStart(3)} | ${String(c).padStart(4)} | ${r.created_at}`,
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
