/**
 * Recover the May 2026 retention snapshot that was overwritten on 2026-06-09.
 *
 * Input: a JSON file exported from a NON-DESTRUCTIVE restore of a pre-overwrite
 * backup (temp project), containing the May row. Accepts either:
 *   - the bare `data` object: { monthly: [...], pro: [...], training_card: [...] }
 *   - or a full row: { report_month, created_at, data: {...} }
 *
 * It backs up the CURRENT (broken) prod May row first, then upserts the
 * restored data. Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/restore-may-retention.ts <path-to-restored.json>
 *   npx tsx scripts/restore-may-retention.ts <path-to-restored.json> --apply
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const REPORT_MONTH = "2026-05-01";
const APPLY = process.argv.includes("--apply");
// Only look at real CLI arguments - argv[0]/argv[1] are the node binary and
// script path, which always contain "/" and would shadow the user's file.
const inputPath = process.argv
  .slice(2)
  .find((a) => a !== "--apply");

interface RetentionData {
  monthly: unknown[];
  pro: unknown[];
  training_card: unknown[];
}

function extractData(parsed: unknown): { data: RetentionData; createdAt: string | null } {
  const obj = parsed as Record<string, unknown>;
  // Full row shape
  if (obj && typeof obj === "object" && "data" in obj && obj.data) {
    return {
      data: obj.data as RetentionData,
      createdAt: (obj.created_at as string) ?? null,
    };
  }
  // Bare data shape
  return { data: obj as unknown as RetentionData, createdAt: null };
}

// Each entry must satisfy the RetentionEntry shape the admin UI renders
// (RetentionTable reads entry.name and entry.attendance.length); a restore
// that passes validation but breaks the page would be stuck, because past
// months are frozen and cannot be rebuilt through the app.
function isValidEntry(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const entry = e as Record<string, unknown>;
  return typeof entry.name === "string" && Array.isArray(entry.attendance);
}

function isValid(d: RetentionData): boolean {
  return (
    Array.isArray(d.monthly) &&
    Array.isArray(d.pro) &&
    Array.isArray(d.training_card) &&
    d.monthly.every(isValidEntry) &&
    d.pro.every(isValidEntry) &&
    d.training_card.every(isValidEntry)
  );
}

async function main(): Promise<void> {
  if (!inputPath) {
    console.error(
      "Provide the restored JSON file path:\n  npx tsx scripts/restore-may-retention.ts <file.json> [--apply]",
    );
    process.exit(1);
  }
  const abs = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(abs, "utf-8"));
  const { data, createdAt } = extractData(parsed);

  if (!isValid(data)) {
    console.error(
      "Input does not look like retention data (need monthly/pro/training_card arrays whose entries have a name string and an attendance array).",
    );
    process.exit(1);
  }

  console.log(
    `\n=== restore-may-retention (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`,
  );
  console.log(`Restored counts -> monthly: ${data.monthly.length}, pro: ${data.pro.length}, training_card: ${data.training_card.length}`);
  console.log(`created_at to set: ${createdAt ?? "(keep existing / now)"}\n`);

  loadEnvLocal();
  const supabase = getAdminClient();

  // 1) Back up the CURRENT (broken) prod row before overwriting.
  const { data: currentRow, error: readErr } = await supabase
    .from("retention_reports")
    .select("report_month, created_at, data")
    .eq("report_month", REPORT_MONTH)
    .maybeSingle();

  if (readErr) {
    console.error("Failed to read current prod row:", readErr.message);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `retention-may-broken-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(currentRow ?? null, null, 2));
  console.log(`Backed up current prod May row -> ${backupPath}`);

  const cur = currentRow as { data?: RetentionData } | null;
  if (cur?.data) {
    console.log(
      `Current prod counts -> monthly: ${cur.data.monthly?.length ?? 0}, pro: ${cur.data.pro?.length ?? 0}, training_card: ${cur.data.training_card?.length ?? 0}\n`,
    );
  }

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write the restored data to prod.");
    return;
  }

  // 2) Upsert restored data into prod. Preserve original snapshot created_at
  //    when available so the row still reads as a May snapshot.
  const upsertRow: Record<string, unknown> = {
    report_month: REPORT_MONTH,
    data: data as unknown as Record<string, unknown>,
  };
  if (createdAt) upsertRow.created_at = createdAt;

  const { error: upErr } = await supabase
    .from("retention_reports")
    .upsert(upsertRow, { onConflict: "report_month" });

  if (upErr) {
    console.error("Upsert failed:", upErr.message);
    process.exit(1);
  }

  console.log("Restored May snapshot written to prod.");
  console.log(`Rollback file: ${backupPath}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
