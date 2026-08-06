/**
 * READ-ONLY: dump one retention_reports row (default 2026-05-01) to a JSON file
 * under scripts/backups/ so a recovered snapshot can be re-applied later.
 * Writes only the local backup file; never touches the DB.
 *
 * Usage: npx tsx scripts/dump-retention-month.ts [YYYY-MM-01]
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const month = process.argv.find((a) => /^\d{4}-\d{2}-01$/.test(a)) ?? "2026-05-01";

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("retention_reports")
    .select("report_month, created_at, data")
    .eq("report_month", month)
    .maybeSingle();

  if (error) {
    console.error("select error:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`No retention_reports row for ${month}`);
    process.exit(1);
  }

  const row = data as {
    report_month: string;
    created_at: string;
    data: { monthly?: unknown[]; pro?: unknown[]; training_card?: unknown[] };
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `retention-${month}-good-${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify(row, null, 2));

  console.log(
    `Dumped ${month}: monthly ${row.data.monthly?.length ?? 0}, pro ${row.data.pro?.length ?? 0}, card ${row.data.training_card?.length ?? 0} (created_at ${row.created_at})`,
  );
  console.log(`Saved -> ${out}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
