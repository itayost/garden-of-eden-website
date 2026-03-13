/**
 * Phase 2: Import reviewed mapping.csv into player_assessments.
 *
 * Usage:
 *   npx tsx scripts/import-from-mapping.ts <mapping.csv> [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient, parseCSVLine } from "./import-utils";

loadEnvLocal();

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");

if (args.length < 1) {
  console.error("Usage: npx tsx scripts/import-from-mapping.ts <mapping.csv> [--dry-run]");
  process.exit(1);
}

const MAPPING_PATH = path.resolve(process.cwd(), args[0]);

interface MappingRow {
  source_file: string;
  csv_name: string;
  matched_profile_name: string;
  profile_id: string;
  assessment_date: string;
  match_confidence: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  sprint_20m: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  jump_2leg_height: number | null;
  kick_power_kaiser: number | null;
  blaze_spot_time: number | null;
  coordination: string | null;
  warnings: string;
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function readMapping(filePath: string): MappingRow[] {
  let content = fs.readFileSync(filePath, "utf-8");
  // Strip BOM
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Skip header
  return lines.slice(1).map((line) => {
    const f = parseCSVLine(line);
    return {
      source_file: f[0] || "",
      csv_name: f[1] || "",
      matched_profile_name: f[2] || "",
      profile_id: f[3] || "",
      assessment_date: f[4] || "",
      match_confidence: f[5] || "",
      sprint_5m: parseNum(f[6] || ""),
      sprint_10m: parseNum(f[7] || ""),
      sprint_20m: parseNum(f[8] || ""),
      jump_2leg_distance: parseNum(f[9] || ""),
      jump_right_leg: parseNum(f[10] || ""),
      jump_left_leg: parseNum(f[11] || ""),
      jump_2leg_height: parseNum(f[12] || ""),
      kick_power_kaiser: parseNum(f[13] || ""),
      blaze_spot_time: parseNum(f[14] || ""),
      coordination: f[15]?.trim() || null,
      warnings: f[16] || "",
    };
  });
}

async function main() {
  console.log(`\nReading mapping: ${MAPPING_PATH}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (!fs.existsSync(MAPPING_PATH)) {
    console.error(`File not found: ${MAPPING_PATH}`);
    process.exit(1);
  }

  const rows = readMapping(MAPPING_PATH);
  console.log(`Total rows: ${rows.length}`);

  // Filter rows with profile_id
  const importable = rows.filter((r) => r.profile_id.trim().length > 0);
  const skipped = rows.filter((r) => r.profile_id.trim().length === 0);
  console.log(`Importable: ${importable.length}, Skipped (no profile_id): ${skipped.length}`);

  if (importable.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  const supabase = getAdminClient();
  let inserted = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const row of importable) {
    // Check for data
    const hasData = [
      row.sprint_5m,
      row.sprint_10m,
      row.jump_2leg_distance,
      row.jump_right_leg,
      row.jump_left_leg,
      row.jump_2leg_height,
      row.kick_power_kaiser,
      row.blaze_spot_time,
      row.coordination,
    ].some((v) => v !== null && v !== "");

    if (!hasData) {
      console.log(`  SKIP (no data): ${row.csv_name}`);
      continue;
    }

    if (!DRY_RUN) {
      // Idempotency check: filter deleted_at IS NULL
      const { data: existing } = await supabase
        .from("player_assessments")
        .select("id")
        .eq("user_id", row.profile_id)
        .eq("assessment_date", row.assessment_date)
        .is("deleted_at", null);

      if (existing && existing.length > 0) {
        console.log(`  EXISTS: ${row.csv_name} (${row.assessment_date})`);
        alreadyExists++;
        continue;
      }

      const { error } = await supabase.from("player_assessments").insert({
        user_id: row.profile_id,
        assessment_date: row.assessment_date,
        sprint_5m: row.sprint_5m,
        sprint_10m: row.sprint_10m,
        sprint_20m: row.sprint_20m,
        jump_2leg_distance: row.jump_2leg_distance,
        jump_right_leg: row.jump_right_leg,
        jump_left_leg: row.jump_left_leg,
        jump_2leg_height: row.jump_2leg_height,
        kick_power_kaiser: row.kick_power_kaiser,
        blaze_spot_time: row.blaze_spot_time,
        coordination: row.coordination,
      });

      if (error) {
        console.error(`  ERROR: ${row.csv_name}: ${error.message}`);
        errors++;
      } else {
        console.log(`  OK: ${row.csv_name} (${row.assessment_date})`);
        inserted++;
      }
    } else {
      console.log(`  DRY: ${row.csv_name} -> ${row.matched_profile_name} (${row.assessment_date})`);
      inserted++;
    }
  }

  console.log("\n--- IMPORT SUMMARY ---");
  console.log(`  ${DRY_RUN ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`  Already existed: ${alreadyExists}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Skipped (no profile_id): ${skipped.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
