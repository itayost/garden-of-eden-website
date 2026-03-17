/**
 * One-off script: Backfill birthdates from all-clients-report.csv age column.
 *
 * Matches by name (normalized) and sets birthdate to January 1 of
 * estimated birth year (currentYear - age).
 *
 * Usage: npx tsx scripts/backfill-birthdates-from-csv.ts [--dry-run]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1).replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  if (!process.env[key]) process.env[key] = val;
}

const CURRENT_YEAR = new Date().getFullYear();

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  if (dryRun) console.log("=== DRY RUN MODE ===\n");

  // Parse CSV
  const csvPath = resolve(process.cwd(), "all-clients-report.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const { data: rows } = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  // Build name -> age map from CSV
  const csvAges = new Map<string, number>();
  for (const row of rows) {
    const name = row["שם"] || "";
    const ageStr = (row["גיל"] || "").trim();
    if (!name || !ageStr) continue;

    const age = parseFloat(ageStr);
    if (isNaN(age) || age <= 0 || age > 99) continue;

    csvAges.set(normalizeName(name), Math.round(age));
  }
  console.log(`CSV: ${csvAges.size} entries with valid age data\n`);

  // Fetch profiles missing birthdate
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .is("birthdate", null);

  if (error) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  console.log(`Profiles missing birthdate: ${(profiles ?? []).length}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles ?? []) {
    const normalizedName = normalizeName(profile.full_name || "");
    const age = csvAges.get(normalizedName);

    if (age === undefined) {
      skipped++;
      continue;
    }

    const birthYear = CURRENT_YEAR - age;
    const birthdate = `${birthYear}-01-01`;

    if (dryRun) {
      console.log(`[DRY RUN] ${profile.full_name}: age ${age} -> ${birthdate}`);
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ birthdate })
      .eq("id", profile.id);

    if (updateError) {
      console.error(`Failed to update ${profile.full_name} (${profile.id}):`, updateError);
      errors++;
    } else {
      console.log(`Updated ${profile.full_name}: age ${age} -> ${birthdate}`);
      updated++;
    }
  }

  console.log("\n--- Results ---");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no age match in CSV): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (!dryRun && updated > 0) {
    console.log("\nBenchmarks will be recalculated automatically by DB triggers.");
  }
}

main();
