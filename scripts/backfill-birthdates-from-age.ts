/**
 * One-off script: Backfill birthdates from Arbox age field.
 *
 * For trainees missing a birthdate, fetches their age from Arbox's
 * allClientsReport and sets birthdate to January 1 of the estimated
 * birth year (currentYear - age).
 *
 * Only updates profiles that:
 * - Have an arbox_user_id
 * - Have a NULL birthdate
 * - Have an age value in Arbox
 *
 * Usage: npx tsx scripts/backfill-birthdates-from-age.ts [--dry-run]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (tsx --env-file is unreliable)
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

const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";
const CURRENT_YEAR = new Date().getFullYear();

type ArboxUser = {
  user_id: number;
  name: string;
  age: number | null;
};

type ArboxReportResponse = {
  statusCode: number;
  data: ArboxUser[];
  extra: { pagination: { total: number; total_pages: number } };
};

async function fetchAllClientsPage(apiKey: string, page: number): Promise<ArboxUser[]> {
  const url = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=${page}&limit=500`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Arbox API error: ${res.status}`);
  const json: ArboxReportResponse = await res.json();
  return json.data ?? [];
}

async function fetchAllArboxUsers(apiKey: string): Promise<Map<number, number>> {
  const ages = new Map<number, number>();
  let page = 1;

  while (page <= 50) {
    const users = await fetchAllClientsPage(apiKey, page);
    for (const user of users) {
      if (user.user_id && user.age !== null && user.age > 0) {
        ages.set(user.user_id, user.age);
      }
    }
    if (users.length < 500) break;
    page++;
  }

  return ages;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.ARBOX_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    console.error("Missing ARBOX_API_KEY in .env.local");
    process.exit(1);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  if (dryRun) console.log("=== DRY RUN MODE ===\n");

  const supabase = createClient(supabaseUrl, serviceKey);

  // Step 1: Fetch ages from Arbox
  console.log("Fetching all clients from Arbox...");
  const arboxAges = await fetchAllArboxUsers(apiKey);
  console.log(`Found ${arboxAges.size} Arbox users with age data\n`);

  // Step 2: Fetch profiles missing birthdate with arbox IDs
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, arbox_user_id, full_name")
    .not("arbox_user_id", "is", null)
    .is("birthdate", null);

  if (error) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  console.log(`${profiles.length} profiles linked to Arbox with missing birthdate\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles) {
    const age = arboxAges.get(profile.arbox_user_id as number);
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
  console.log(`Skipped (no age in Arbox): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (!dryRun && updated > 0) {
    console.log("\nBenchmarks will be recalculated automatically by DB triggers.");
  }
}

main();
