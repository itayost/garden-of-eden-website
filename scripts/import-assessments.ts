/**
 * Import player assessments from CSV files into existing profiles.
 *
 * Usage:
 *   npx tsx scripts/import-assessments.ts <csv-file> <assessment-date> [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/import-assessments.ts "assesments-to-import/מבדקים כדורגלנים - אוקטובר.csv" 2025-10-01 --dry-run
 *   npx tsx scripts/import-assessments.ts "assesments-to-import/מבדקים כדורגלנים - אוקטובר.csv" 2025-10-01
 *
 * What it does:
 *   1. Loads all existing profiles from Supabase
 *   2. Parses the CSV file
 *   3. Fuzzy-matches player names to existing profiles
 *   4. Inserts assessments for matched profiles (skips unmatched)
 *   5. Outputs a detailed report
 */

import * as fs from "fs";
import * as path from "path";
import {
  loadEnvLocal,
  getAdminClient,
  parseCSVLine,
  extractNumber,
  normalizeToCm,
  parseSingleLegJump,
  parseKaiserHeight,
  mapCoordination,
  parseBlazeSpot,
  findProfileMatch,
  isHeaderOrMetadata,
  type LegJumps,
  type ProfileMatch,
} from "./import-utils";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

loadEnvLocal();

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");

if (args.length < 2) {
  console.error(
    "Usage: npx tsx scripts/import-assessments.ts <csv-file> <assessment-date> [--dry-run]"
  );
  console.error(
    'Example: npx tsx scripts/import-assessments.ts "assesments-to-import/file.csv" 2025-10-01'
  );
  process.exit(1);
}

const CSV_PATH = path.resolve(process.cwd(), args[0]);
const ASSESSMENT_DATE = args[1];

if (!/^\d{4}-\d{2}-\d{2}$/.test(ASSESSMENT_DATE)) {
  console.error("Assessment date must be in YYYY-MM-DD format");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

interface CsvRow {
  name: string;
  kaiserHeight: string;
  jump2legDistance: string;
  singleLegJump: string;
  sprint5m: string;
  sprint10m: string;
  flexibility: string;
  stability: string;
  coordination: string;
  runningTechnique: string;
  quickThinking: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const dataLines = lines.slice(1); // skip header

  return dataLines
    .map((line) => {
      const fields = parseCSVLine(line);
      return {
        name: fields[0] || "",
        kaiserHeight: fields[1] || "",
        jump2legDistance: fields[2] || "",
        singleLegJump: fields[3] || "",
        sprint5m: fields[4] || "",
        sprint10m: fields[5] || "",
        flexibility: fields[6] || "",
        stability: fields[7] || "",
        coordination: fields[8] || "",
        runningTechnique: fields[9] || "",
        quickThinking: fields[10] || "",
      };
    })
    .filter((row) => {
      const name = row.name.trim();
      return !isHeaderOrMetadata(name);
    });
}

// ---------------------------------------------------------------------------
// Assessment Builder
// ---------------------------------------------------------------------------

interface AssessmentData {
  user_id: string;
  assessment_date: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  jump_2leg_height: number | null;
  kick_power_kaiser: number | null;
  blaze_spot_time: number | null;
  coordination: "deficient" | "basic" | "advanced" | null;
  assessed_by: string | null;
}

function buildAssessmentData(
  row: CsvRow,
  userId: string
): { data: AssessmentData; warnings: string[] } {
  const warnings: string[] = [];

  // Sprint 5m
  let sprint5m = extractNumber(row.sprint5m);
  if (sprint5m !== null && sprint5m > 30) {
    warnings.push(
      `sprint_5m=${sprint5m} -> ${sprint5m / 100} (auto-corrected)`
    );
    sprint5m = sprint5m / 100;
  }

  // Sprint 10m
  let sprint10m = extractNumber(row.sprint10m);
  if (sprint10m !== null && sprint10m > 30) {
    warnings.push(
      `sprint_10m=${sprint10m} -> ${sprint10m / 100} (auto-corrected)`
    );
    sprint10m = sprint10m / 100;
  }

  // 2-leg distance jump
  let jump2legDistance: number | null = null;
  const rawDistance = extractNumber(row.jump2legDistance);
  if (rawDistance !== null) {
    jump2legDistance = normalizeToCm(rawDistance);
    if (jump2legDistance > 500) {
      warnings.push(`jump_2leg_distance=${jump2legDistance}cm exceeds 500`);
    }
  }

  // Single-leg jumps
  const legJumps: LegJumps = parseSingleLegJump(row.singleLegJump);

  // Kaiser column: jump height + kick power
  const kaiser = parseKaiserHeight(row.kaiserHeight);

  // Coordination
  const coordination = mapCoordination(row.coordination);

  // Blaze Spot
  const blazeSpot = parseBlazeSpot(row.quickThinking);

  return {
    data: {
      user_id: userId,
      assessment_date: ASSESSMENT_DATE,
      sprint_5m: sprint5m,
      sprint_10m: sprint10m,
      jump_2leg_distance: jump2legDistance,
      jump_right_leg: legJumps.right,
      jump_left_leg: legJumps.left,
      jump_2leg_height: kaiser.jumpHeight,
      kick_power_kaiser: kaiser.kickPower,
      blaze_spot_time: blazeSpot,
      coordination,
      assessed_by: null,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function fmt(val: number | null, unit: string): string {
  if (val === null) return "-";
  return `${val}${unit}`;
}

interface ImportResult {
  csvName: string;
  matchedProfile: string | null;
  userId: string | null;
  assessmentId: string | null;
  warnings: string[];
  error: string | null;
  assessment: AssessmentData | null;
}

function printReport(results: ImportResult[]) {
  const matched = results.filter((r) => r.userId !== null && !r.error);
  const unmatched = results.filter((r) => r.userId === null && !r.error);
  const failed = results.filter((r) => r.error !== null);

  console.log("\n" + "=".repeat(70));
  console.log("  ASSESSMENT IMPORT REPORT");
  console.log("=".repeat(70));
  console.log(`  Mode:           ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`  File:           ${path.basename(CSV_PATH)}`);
  console.log(`  Date:           ${ASSESSMENT_DATE}`);
  console.log(`  Total rows:     ${results.length}`);
  console.log(`  Matched:        ${matched.length}`);
  console.log(`  Unmatched:      ${unmatched.length}`);
  console.log(`  Errors:         ${failed.length}`);
  console.log("=".repeat(70));

  if (unmatched.length > 0) {
    console.log("\n--- UNMATCHED NAMES (skipped) ---");
    for (const r of unmatched) {
      console.log(`  ${r.csvName}`);
    }
  }

  if (failed.length > 0) {
    console.log("\n--- ERRORS ---");
    for (const r of failed) {
      console.log(`  ${r.csvName}: ${r.error}`);
    }
  }

  const withWarnings = results.filter((r) => r.warnings.length > 0);
  if (withWarnings.length > 0) {
    console.log("\n--- WARNINGS ---");
    for (const r of withWarnings) {
      for (const w of r.warnings) {
        console.log(`  ${r.csvName}: ${w}`);
      }
    }
  }

  if (matched.length > 0) {
    console.log("\n--- IMPORTED ASSESSMENTS ---");
    console.log(
      `${"CSV Name".padEnd(22)} ${"Matched To".padEnd(22)} ${"5m".padEnd(7)} ${"10m".padEnd(7)} ${"J2leg".padEnd(7)} ${"JR".padEnd(7)} ${"JL".padEnd(7)} ${"JH".padEnd(7)} ${"K%".padEnd(5)} ${"BSpot".padEnd(6)} ${"Coord".padEnd(10)}`
    );
    console.log("-".repeat(110));
    for (const r of matched) {
      const a = r.assessment!;
      console.log(
        `${r.csvName.padEnd(22)} ${(r.matchedProfile || "").padEnd(22)} ${fmt(a.sprint_5m, "s").padEnd(7)} ${fmt(a.sprint_10m, "s").padEnd(7)} ${fmt(a.jump_2leg_distance, "").padEnd(7)} ${fmt(a.jump_right_leg, "").padEnd(7)} ${fmt(a.jump_left_leg, "").padEnd(7)} ${fmt(a.jump_2leg_height, "").padEnd(7)} ${fmt(a.kick_power_kaiser, "").padEnd(5)} ${fmt(a.blaze_spot_time, "").padEnd(6)} ${(a.coordination || "-").padEnd(10)}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nReading CSV: ${CSV_PATH}`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`File not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCsv(CSV_PATH);
  console.log(`Found ${rows.length} data rows`);

  // Load all profiles
  const supabase = getAdminClient();
  console.log("Loading profiles from Supabase...");

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee");

  if (profilesError) {
    console.error("Failed to load profiles:", profilesError);
    process.exit(1);
  }

  console.log(`Loaded ${profiles.length} trainee profiles`);

  const results: ImportResult[] = [];

  for (const row of rows) {
    const result: ImportResult = {
      csvName: row.name.trim(),
      matchedProfile: null,
      userId: null,
      assessmentId: null,
      warnings: [],
      error: null,
      assessment: null,
    };

    try {
      // Match name to profile
      const { profile: match } = findProfileMatch(row.name, profiles as ProfileMatch[]);
      if (!match) {
        results.push(result);
        continue;
      }

      result.matchedProfile = match.full_name;
      result.userId = match.id;

      // Build assessment
      const { data: assessment, warnings } = buildAssessmentData(
        row,
        match.id
      );
      result.assessment = assessment;
      result.warnings = warnings;

      // Check if any data to insert
      const hasData = [
        assessment.sprint_5m,
        assessment.sprint_10m,
        assessment.jump_2leg_distance,
        assessment.jump_right_leg,
        assessment.jump_left_leg,
        assessment.jump_2leg_height,
        assessment.kick_power_kaiser,
        assessment.blaze_spot_time,
        assessment.coordination,
      ].some((v) => v !== null);

      if (!hasData) {
        result.warnings.push("No assessment data to insert");
        results.push(result);
        continue;
      }

      if (!DRY_RUN) {
        // Check for existing assessment (idempotency)
        const { data: existing } = await supabase
          .from("player_assessments")
          .select("id")
          .eq("user_id", match.id)
          .eq("assessment_date", ASSESSMENT_DATE);

        if (existing && existing.length > 0) {
          result.warnings.push("Assessment already exists for this date - skipped");
          result.assessmentId = existing[0].id;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("player_assessments")
            .insert(assessment)
            .select("id")
            .single();

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }
          result.assessmentId = inserted.id;
        }
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    results.push(result);
  }

  printReport(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
