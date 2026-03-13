/**
 * Phase 1: Extract all assessment CSVs into a single mapping.csv for review.
 *
 * Usage:
 *   npx tsx scripts/extract-assessments.ts [--output path/to/mapping.csv]
 *
 * Default output: assesments-to-import/mapping.csv
 */

import * as fs from "fs";
import * as path from "path";
import {
  loadEnvLocal,
  getAdminClient,
  parseStandardColumnar,
  parseReorderedColumnar,
  parseVerticalCard,
  parseVerticalLabeled,
  findProfileMatch,
  type NormalizedAssessmentRow,
  type ProfileMatch,
} from "./import-utils";

loadEnvLocal();

// ---------------------------------------------------------------------------
// File registry: maps each CSV file to its parser, date, and line ranges
// ---------------------------------------------------------------------------

interface FileConfig {
  filename: string;
  parser: "standard" | "reordered" | "verticalCard" | "verticalLabeled";
  date: string;
  lineRange?: { start: number; end: number }; // 1-indexed, inclusive
}

const FILE_CONFIGS: FileConfig[] = [
  { filename: "מבדקים כדורגלנים - יולי.csv", parser: "standard", date: "2024-07-01" },
  { filename: "מבדקים כדורגלנים - אוגוסט.csv", parser: "standard", date: "2024-08-01" },
  { filename: "מבדקים כדורגלנים - אוקטובר.csv", parser: "standard", date: "2024-10-01" },
  { filename: "מבדקים כדורגלנים - מרץ - אפריל- .csv", parser: "standard", date: "2024-03-01" },
  { filename: "מבדקים כדורגלנים - ינואר25 (1).csv", parser: "standard", date: "2025-01-01" },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "reordered", date: "2024-11-01", lineRange: { start: 1, end: 95 } },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "reordered", date: "2024-11-01", lineRange: { start: 271, end: 275 } },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "verticalCard", date: "2024-11-01", lineRange: { start: 281, end: 520 } },
  { filename: "מבדקים כדורגלנים - מבדקים כאוכב נובמבר.csv", parser: "verticalLabeled", date: "2024-11-01" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSection(filePath: string, lineRange?: { start: number; end: number }): string {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!lineRange) return content;
  const lines = content.split("\n");
  return lines.slice(lineRange.start - 1, lineRange.end).join("\n");
}

function parseSection(config: FileConfig, content: string): NormalizedAssessmentRow[] {
  const label = config.lineRange
    ? `${config.filename}:${config.lineRange.start}-${config.lineRange.end}`
    : config.filename;

  switch (config.parser) {
    case "standard": return parseStandardColumnar(content, label, config.date);
    case "reordered": return parseReorderedColumnar(content, label, config.date);
    case "verticalCard": return parseVerticalCard(content, label, config.date);
    case "verticalLabeled": return parseVerticalLabeled(content, label, config.date);
  }
}

// ---------------------------------------------------------------------------
// CSV Output
// ---------------------------------------------------------------------------

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeMappingCSV(
  outputPath: string,
  rows: Array<NormalizedAssessmentRow & {
    matched_profile_name: string;
    profile_id: string;
    match_confidence: string;
  }>
): void {
  const header = [
    "source_file", "csv_name", "matched_profile_name", "profile_id",
    "assessment_date", "match_confidence",
    "sprint_5m", "sprint_10m", "sprint_20m",
    "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
    "jump_2leg_height", "kick_power_kaiser", "blaze_spot_time",
    "coordination", "warnings",
  ].join(",");

  const lines = rows.map((r) => [
    escapeCSV(r.source_file),
    escapeCSV(r.csv_name),
    escapeCSV(r.matched_profile_name),
    r.profile_id,
    r.assessment_date,
    r.match_confidence,
    r.sprint_5m ?? "",
    r.sprint_10m ?? "",
    r.sprint_20m ?? "",
    r.jump_2leg_distance ?? "",
    r.jump_right_leg ?? "",
    r.jump_left_leg ?? "",
    r.jump_2leg_height ?? "",
    r.kick_power_kaiser ?? "",
    r.blaze_spot_time ?? "",
    r.coordination ?? "",
    escapeCSV(r.warnings.join("; ")),
  ].join(","));

  // BOM for Hebrew in Excel
  const bom = "\uFEFF";
  fs.writeFileSync(outputPath, bom + header + "\n" + lines.join("\n") + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const outputFlag = process.argv.find((a) => a.startsWith("--output="));
  const outputPath = outputFlag
    ? outputFlag.split("=")[1]
    : args[0] || path.join("assesments-to-import", "mapping.csv");

  const baseDir = path.join(process.cwd(), "assesments-to-import");

  // Parse all sections
  console.log("Parsing CSV files...");
  const allRows: NormalizedAssessmentRow[] = [];

  for (const config of FILE_CONFIGS) {
    const filePath = path.join(baseDir, config.filename);
    if (!fs.existsSync(filePath)) {
      console.error(`  SKIP: ${config.filename} (not found)`);
      continue;
    }
    const content = readFileSection(filePath, config.lineRange);
    const rows = parseSection(config, content);
    const rangeLabel = config.lineRange ? ` [lines ${config.lineRange.start}-${config.lineRange.end}]` : "";
    console.log(`  ${config.filename}${rangeLabel}: ${rows.length} players`);
    allRows.push(...rows);
  }

  console.log(`\nTotal parsed rows: ${allRows.length}`);

  // Load profiles for matching
  const supabase = getAdminClient();
  console.log("Loading profiles from Supabase...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .order("full_name");

  if (error) {
    console.error("Failed to load profiles:", error);
    process.exit(1);
  }
  console.log(`Loaded ${profiles.length} trainee profiles`);

  // Match names
  const mappedRows = allRows.map((row) => {
    const { profile, confidence } = findProfileMatch(row.csv_name, profiles as ProfileMatch[]);
    return {
      ...row,
      matched_profile_name: profile?.full_name || "",
      profile_id: profile?.id || "",
      match_confidence: confidence,
    };
  });

  // Write mapping CSV
  writeMappingCSV(path.resolve(process.cwd(), outputPath), mappedRows);
  console.log(`\nMapping written to: ${outputPath}`);

  // Summary
  const matched = mappedRows.filter((r) => r.match_confidence !== "none");
  const unmatched = mappedRows.filter((r) => r.match_confidence === "none");
  const withWarnings = mappedRows.filter((r) => r.warnings.length > 0);
  console.log(`  Matched: ${matched.length} (exact: ${matched.filter((r) => r.match_confidence === "exact").length}, partial: ${matched.filter((r) => r.match_confidence === "partial").length}, token: ${matched.filter((r) => r.match_confidence === "token").length})`);
  console.log(`  Unmatched: ${unmatched.length}`);
  console.log(`  With warnings: ${withWarnings.length}`);

  if (unmatched.length > 0) {
    console.log("\nUnmatched names:");
    for (const r of unmatched) {
      console.log(`  ${r.csv_name} (${r.source_file})`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
