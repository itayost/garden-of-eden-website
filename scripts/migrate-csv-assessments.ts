/**
 * Migration script: Import player assessments from CSV
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-csv-assessments.ts
 *
 * What it does:
 *   1. Parses the CSV file
 *   2. Creates Supabase auth users with placeholder emails
 *   3. Creates trainee profiles
 *   4. Inserts assessments with date 2025-01-01
 *   5. Outputs a detailed report
 *
 * Run with --dry-run to preview without writing to DB:
 *   npx tsx --env-file=.env.local scripts/migrate-csv-assessments.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes and trailing literal \n from Vercel env pull
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CSV_PATH = path.join(
  process.cwd(),
  "מבדקים כדורגלנים - ינואר25.csv"
);
const ASSESSMENT_DATE = "2025-01-01";
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// CSV Parsing (simple — no need for papaparse for this structure)
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

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => {
      // Handle quoted fields with commas inside
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

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
    .filter((row) => row.name.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Number Parsing Helpers
// ---------------------------------------------------------------------------

/** Extract the first number from a messy string. Handles comma decimals. */
function extractNumber(value: string): number | null {
  if (!value || value === "??" || value === "0") return null;

  // Strip Hebrew text but keep numbers, dots, commas, minus
  let cleaned = value.replace(/[^\d.,\-]/g, "").trim();

  // Handle comma as decimal separator (e.g., "1,11" → "1.11")
  // But only if there's one comma and it looks like a decimal
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 3) {
      cleaned = parts.join(".");
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return null;
  return num;
}

/** Normalize jump distance to cm. Values < 10 are assumed to be meters. */
function normalizeToCm(value: number): number {
  if (value < 10) {
    return Math.round(value * 100 * 10) / 10; // meters → cm, 1 decimal
  }
  return value; // already cm
}

// ---------------------------------------------------------------------------
// Single-Leg Jump Parser
// ---------------------------------------------------------------------------

interface LegJumps {
  right: number | null;
  left: number | null;
}

function parseSingleLegJump(value: string): LegJumps {
  if (!value || value === "??") return { right: null, left: null };

  const text = value.trim();

  // Check for "ושמאל" (and left) — means same value for both legs
  if (text.includes("ושמאל")) {
    const numbers = text.match(/[\d]+\.?[\d]*/g);
    if (numbers && numbers.length >= 1) {
      const lastNum = parseFloat(numbers[numbers.length - 1]);
      const cm = normalizeToCm(lastNum);
      return { right: cm, left: cm };
    }
    return { right: null, left: null };
  }

  // Find keyword positions for right (ימין/ימן) and left (שמאל)
  const rightPositions: number[] = [];
  const leftPositions: number[] = [];

  const rightRegex = /ימי[ןנ]|ימן/g;
  let match;
  while ((match = rightRegex.exec(text)) !== null) {
    rightPositions.push(match.index);
  }
  const leftRegex = /שמאל/g;
  while ((match = leftRegex.exec(text)) !== null) {
    leftPositions.push(match.index);
  }

  // Extract all numbers
  const numberMatches = [...text.matchAll(/([\d]+\.?[\d]*)/g)].map((m) => ({
    value: parseFloat(m[1]),
    index: m.index!,
  }));

  if (numberMatches.length === 0) return { right: null, left: null };

  let rightVal: number | null = null;
  let leftVal: number | null = null;

  const hasRight = rightPositions.length > 0;
  const hasLeft = leftPositions.length > 0;

  if (hasRight && hasLeft && numberMatches.length >= 2) {
    // Both keywords present: process keywords in positional order,
    // greedily assign closest unused number to each.
    // Handles both "keyword NUM ... keyword NUM" and "NUM keyword ... NUM keyword".
    const keywords = [
      ...rightPositions.map((p) => ({ pos: p, side: "right" as const })),
      ...leftPositions.map((p) => ({ pos: p, side: "left" as const })),
    ].sort((a, b) => a.pos - b.pos);

    const usedIndices = new Set<number>();

    for (const kw of keywords) {
      let bestNum: (typeof numberMatches)[0] | null = null;
      let bestDist = Infinity;

      for (const nm of numberMatches) {
        if (usedIndices.has(nm.index)) continue;
        const dist = Math.abs(nm.index - kw.pos);
        if (dist < bestDist) {
          bestDist = dist;
          bestNum = nm;
        }
      }

      if (bestNum) {
        if (kw.side === "right") rightVal = bestNum.value;
        else leftVal = bestNum.value;
        usedIndices.add(bestNum.index);
      }
    }
  } else if ((hasRight || hasLeft) && numberMatches.length >= 2) {
    // Only one keyword: number before keyword → other leg, number after → this leg
    const kwPos = hasRight ? rightPositions[0] : leftPositions[0];
    const before = numberMatches.filter((n) => n.index < kwPos);
    const after = numberMatches.filter((n) => n.index > kwPos);

    const thisLegNum = after.length > 0 ? after[0].value : null;
    const otherLegNum = before.length > 0 ? before[before.length - 1].value : null;

    if (hasRight) {
      rightVal = thisLegNum;
      leftVal = otherLegNum;
    } else {
      leftVal = thisLegNum;
      rightVal = otherLegNum;
    }
  } else if (numberMatches.length >= 2) {
    // No keywords — assume first is right, second is left
    rightVal = numberMatches[0].value;
    leftVal = numberMatches[1].value;
  }

  return {
    right: rightVal !== null ? normalizeToCm(rightVal) : null,
    left: leftVal !== null ? normalizeToCm(leftVal) : null,
  };
}

// ---------------------------------------------------------------------------
// Coordination Mapper (0-4 → enum)
// ---------------------------------------------------------------------------

function mapCoordination(
  value: string
): "deficient" | "basic" | "advanced" | null {
  const num = parseInt(value, 10);
  if (isNaN(num) || num === 0) return null; // 0 means "not tested"
  if (num === 1) return "deficient";
  if (num <= 3) return "basic";
  if (num <= 5) return "advanced";
  return null;
}

// ---------------------------------------------------------------------------
// Kaiser / Height column parser
// ---------------------------------------------------------------------------

function parseKaiserPower(value: string): number | null {
  if (!value) return null;
  // Extract ALL numbers and return the largest one.
  // This handles formats like "204 7%", "7% 146", "%3 71", "248 שיא 7%"
  // The percentage (3%, 5%, 7%) is always small; the Kaiser value is always larger.
  const matches = value.match(/\d+/g);
  if (!matches) return null;
  const numbers = matches.map(Number).filter((n) => n > 0);
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

// ---------------------------------------------------------------------------
// Name deduplication
// ---------------------------------------------------------------------------

function deduplicateNames(rows: CsvRow[]): Map<CsvRow, string> {
  const nameCount = new Map<string, number>();
  const result = new Map<CsvRow, string>();

  for (const row of rows) {
    const name = row.name.trim();
    const count = nameCount.get(name) || 0;
    nameCount.set(name, count + 1);

    if (count > 0) {
      result.set(row, `${name} (${count + 1})`);
    } else {
      result.set(row, name);
    }
  }

  // Go back and rename the first occurrence if there were duplicates
  for (const row of rows) {
    const name = row.name.trim();
    const total = nameCount.get(name) || 0;
    if (total > 1 && result.get(row) === name) {
      result.set(row, `${name} (1)`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Email generation from name
// ---------------------------------------------------------------------------

function nameToEmail(name: string, index: number): string {
  // Use a simple numbered approach since names are in Hebrew
  return `trainee-${String(index + 1).padStart(3, "0")}@edengarden.co.il`;
}

// ---------------------------------------------------------------------------
// Build assessment data from CSV row
// ---------------------------------------------------------------------------

interface AssessmentData {
  user_id: string;
  assessment_date: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  kick_power_kaiser: number | null;
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
    warnings.push(`sprint_5m=${sprint5m} auto-corrected to ${sprint5m / 100} (likely missing decimal)`);
    sprint5m = sprint5m / 100;
  }

  // Sprint 10m
  let sprint10m = extractNumber(row.sprint10m);
  if (sprint10m !== null && sprint10m > 30) {
    warnings.push(`sprint_10m=${sprint10m} auto-corrected to ${sprint10m / 100} (likely missing decimal)`);
    sprint10m = sprint10m / 100;
  }

  // 2-leg distance jump
  let jump2legDistance: number | null = null;
  const rawDistance = extractNumber(row.jump2legDistance);
  if (rawDistance !== null) {
    jump2legDistance = normalizeToCm(rawDistance);
    if (jump2legDistance > 500) {
      warnings.push(
        `jump_2leg_distance=${jump2legDistance}cm exceeds 500 — suspicious`
      );
    }
  }

  // Single-leg jumps
  const legJumps = parseSingleLegJump(row.singleLegJump);

  // Kaiser power
  const kaiserPower = parseKaiserPower(row.kaiserHeight);

  // Coordination
  const coordination = mapCoordination(row.coordination);

  return {
    data: {
      user_id: userId,
      assessment_date: ASSESSMENT_DATE,
      sprint_5m: sprint5m,
      sprint_10m: sprint10m,
      jump_2leg_distance: jump2legDistance,
      jump_right_leg: legJumps.right,
      jump_left_leg: legJumps.left,
      kick_power_kaiser: kaiserPower,
      coordination: coordination,
      assessed_by: null,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface MigrationResult {
  name: string;
  email: string;
  userId: string | null;
  assessmentId: string | null;
  warnings: string[];
  error: string | null;
  assessment: AssessmentData | null;
}

function printReport(results: MigrationResult[]) {
  const succeeded = results.filter((r) => r.userId !== null && !r.error);
  const failed = results.filter((r) => r.error !== null);
  const withWarnings = results.filter((r) => r.warnings.length > 0);

  console.log("\n" + "=".repeat(70));
  console.log("  MIGRATION REPORT");
  console.log("=".repeat(70));
  console.log(`  Mode:         ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`  Date:         ${ASSESSMENT_DATE}`);
  console.log(`  Total rows:   ${results.length}`);
  console.log(`  Succeeded:    ${succeeded.length}`);
  console.log(`  Failed:       ${failed.length}`);
  console.log(`  With warnings: ${withWarnings.length}`);
  console.log("=".repeat(70));

  if (failed.length > 0) {
    console.log("\n--- FAILURES ---");
    for (const r of failed) {
      console.log(`  ${r.name}: ${r.error}`);
    }
  }

  if (withWarnings.length > 0) {
    console.log("\n--- WARNINGS ---");
    for (const r of withWarnings) {
      for (const w of r.warnings) {
        console.log(`  ${r.name}: ${w}`);
      }
    }
  }

  console.log("\n--- IMPORTED ASSESSMENTS ---");
  console.log(
    `${"Name".padEnd(25)} ${"Sprint5m".padEnd(10)} ${"Sprint10m".padEnd(10)} ${"Jump2leg".padEnd(10)} ${"JumpR".padEnd(10)} ${"JumpL".padEnd(10)} ${"Kaiser".padEnd(10)} ${"Coord".padEnd(12)}`
  );
  console.log("-".repeat(97));

  for (const r of succeeded) {
    const a = r.assessment!;
    console.log(
      `${r.name.padEnd(25)} ${fmt(a.sprint_5m, "s").padEnd(10)} ${fmt(a.sprint_10m, "s").padEnd(10)} ${fmt(a.jump_2leg_distance, "cm").padEnd(10)} ${fmt(a.jump_right_leg, "cm").padEnd(10)} ${fmt(a.jump_left_leg, "cm").padEnd(10)} ${fmt(a.kick_power_kaiser, "").padEnd(10)} ${(a.coordination || "-").padEnd(12)}`
    );
  }

  console.log("\n--- CREATED USERS ---");
  for (const r of succeeded) {
    console.log(`  ${r.name.padEnd(25)} → ${r.email}`);
  }
}

function fmt(val: number | null, unit: string): string {
  if (val === null) return "-";
  return `${val}${unit}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nReading CSV: ${CSV_PATH}`);
  const rows = parseCsv(CSV_PATH);
  console.log(`Found ${rows.length} rows with names`);

  const nameMap = deduplicateNames(rows);
  const supabase = DRY_RUN ? null : getAdminClient();
  const results: MigrationResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const displayName = nameMap.get(row)!;
    const email = nameToEmail(displayName, i);

    const result: MigrationResult = {
      name: displayName,
      email,
      userId: null,
      assessmentId: null,
      warnings: [],
      error: null,
      assessment: null,
    };

    try {
      if (DRY_RUN) {
        // In dry-run, just parse and report
        const { data: assessment, warnings } = buildAssessmentData(
          row,
          "dry-run-id"
        );
        result.userId = "dry-run-id";
        result.assessment = assessment;
        result.warnings = warnings;
      } else {
        // 1. Create auth user (or find existing one)
        let userId: string;
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: displayName },
          });

        if (authError) {
          // If user already exists, look them up by email
          if (authError.message.includes("already been registered")) {
            const { data: listData, error: listError } =
              await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (listError) throw new Error(`List users failed: ${listError.message}`);
            const existing = listData.users.find((u) => u.email === email);
            if (!existing) throw new Error(`User ${email} registered but not found`);
            userId = existing.id;
            result.warnings.push("Auth user already existed — reusing");
          } else {
            throw new Error(`Auth create failed: ${authError.message}`);
          }
        } else {
          userId = authData.user.id;
        }
        result.userId = userId;

        // 2. Update profile with full name (trigger auto-creates profile on auth user creation)
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: displayName })
          .eq("id", userId);

        if (profileError) {
          throw new Error(`Profile update failed: ${profileError.message}`);
        }

        // 3. Check for existing assessment (idempotency)
        const { data: existingAssessments } = await supabase
          .from("player_assessments")
          .select("id")
          .eq("user_id", userId)
          .eq("assessment_date", ASSESSMENT_DATE);

        if (existingAssessments && existingAssessments.length > 0) {
          result.warnings.push("Assessment already exists — skipped insert");
          const { data: assessment, warnings } = buildAssessmentData(row, userId);
          result.assessment = assessment;
          result.warnings.push(...warnings);
          result.assessmentId = existingAssessments[0].id;
        } else {
          // Build and insert assessment
          const { data: assessment, warnings } = buildAssessmentData(
            row,
            userId
          );
          result.assessment = assessment;
          result.warnings = warnings;

          // Check if there's any actual data to insert
          const hasData = [
            assessment.sprint_5m,
            assessment.sprint_10m,
            assessment.jump_2leg_distance,
            assessment.jump_right_leg,
            assessment.jump_left_leg,
            assessment.kick_power_kaiser,
            assessment.coordination,
          ].some((v) => v !== null);

          if (hasData) {
            const { data: assessmentResult, error: assessmentError } =
              await supabase
                .from("player_assessments")
                .insert(assessment)
                .select("id")
                .single();

            if (assessmentError) {
              throw new Error(
                `Assessment insert failed: ${assessmentError.message}`
              );
            }
            result.assessmentId = assessmentResult.id;
          } else {
            result.warnings.push("No assessment data — user created but no assessment inserted");
          }
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
