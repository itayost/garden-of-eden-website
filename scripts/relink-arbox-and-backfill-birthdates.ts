/**
 * One-off script: Re-link Arbox user IDs by phone matching, then backfill birthdates.
 *
 * Problem: DB profiles have stale arbox_user_ids (93xxxx range) that don't match
 * current Arbox API user IDs (94xxxx range). The nightly birthday sync fails
 * because of this mismatch.
 *
 * This script:
 * 1. Fetches all Arbox users (with phones, ages) from allClientsReport
 * 2. Fetches all Arbox birthdays from birthdayReport (12 monthly windows)
 * 3. For each profile missing a birthdate:
 *    a. Matches by normalized phone to find the current Arbox user_id
 *    b. Falls back to normalized name matching
 *    c. Updates arbox_user_id if it changed
 *    d. Sets birthdate from Arbox birthday report (exact date)
 *    e. Falls back to age field: estimates birthdate as Jan 1 of (currentYear - age)
 *
 * Usage: npx tsx scripts/relink-arbox-and-backfill-birthdates.ts [--dry-run]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed
    .slice(eqIdx + 1)
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  if (!process.env[key]) process.env[key] = val;
}

const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";
const MAX_PAGES = 50;
const CURRENT_YEAR = new Date().getFullYear();

// ── Types ──

type ArboxUser = {
  user_id: number;
  name: string;
  phone: string | null;
  age: number | null;
};

type ArboxBirthdayEntry = {
  user_id: number;
  name: string;
  birthday: string | null;
};

// ── Phone normalization (same as src/lib/arbox/normalize-phone.ts) ──

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/(?!^\+)\D/g, "");
  if (cleaned.startsWith("+972") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("972") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 10)
    return `+972${cleaned.slice(1)}`;
  return null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Arbox API fetchers ──

async function fetchAllArboxUsers(apiKey: string): Promise<ArboxUser[]> {
  const all: ArboxUser[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=${page}&limit=500`;
    const res = await fetch(url, {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Arbox API error: ${res.status}`);
    const json = await res.json();
    all.push(...(json.data ?? []));
    if ((json.data ?? []).length < 500) break;
    page++;
  }

  return all;
}

async function fetchAllBirthdays(
  apiKey: string,
): Promise<Map<number, string>> {
  const birthdays = new Map<number, string>();

  const months = [
    { from: "2000-01-01", to: "2000-01-31" },
    { from: "2000-02-01", to: "2000-02-29" },
    { from: "2000-03-01", to: "2000-03-31" },
    { from: "2000-04-01", to: "2000-04-30" },
    { from: "2000-05-01", to: "2000-05-31" },
    { from: "2000-06-01", to: "2000-06-30" },
    { from: "2000-07-01", to: "2000-07-31" },
    { from: "2000-08-01", to: "2000-08-31" },
    { from: "2000-09-01", to: "2000-09-30" },
    { from: "2000-10-01", to: "2000-10-31" },
    { from: "2000-11-01", to: "2000-11-30" },
    { from: "2000-12-01", to: "2000-12-31" },
  ];

  for (const { from, to } of months) {
    let page = 1;
    while (page <= MAX_PAGES) {
      const url = `${BASE_URL}/reports/birthdayReport?group_by=user&reportName=birthdayReport&fromDate=${from}&toDate=${to}&page=${page}&limit=500`;
      const res = await fetch(url, {
        headers: { "api-key": apiKey, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Arbox birthday API error: ${res.status}`);
      const json = await res.json();
      const entries: ArboxBirthdayEntry[] = json.data ?? [];

      for (const entry of entries) {
        if (entry.user_id && entry.birthday) {
          birthdays.set(entry.user_id, entry.birthday);
        }
      }

      if (entries.length < 500) break;
      page++;
    }
  }

  return birthdays;
}

// ── Main ──

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
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  if (dryRun) console.log("=== DRY RUN MODE ===\n");

  const supabase = createClient(supabaseUrl, serviceKey);

  // Step 1: Fetch all Arbox users
  console.log("Step 1: Fetching all Arbox users...");
  const arboxUsers = await fetchAllArboxUsers(apiKey);
  console.log(`  Found ${arboxUsers.length} Arbox users\n`);

  // Build phone -> arbox user lookup
  const arboxByPhone = new Map<string, ArboxUser>();
  const arboxByName = new Map<string, ArboxUser>();

  for (const user of arboxUsers) {
    const phone = normalizePhone(user.phone);
    if (phone) arboxByPhone.set(phone, user);

    const name = normalizeName(user.name || "");
    if (name) arboxByName.set(name, user);
  }

  console.log(
    `  Phone index: ${arboxByPhone.size} entries, Name index: ${arboxByName.size} entries\n`,
  );

  // Step 2: Fetch all Arbox birthdays
  console.log("Step 2: Fetching Arbox birthdays (12 monthly windows)...");
  const arboxBirthdays = await fetchAllBirthdays(apiKey);
  console.log(`  Found ${arboxBirthdays.size} birthdays in Arbox\n`);

  // Step 3: Fetch profiles missing birthdates
  console.log("Step 3: Fetching profiles missing birthdates...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, arbox_user_id")
    .eq("role", "trainee")
    .is("birthdate", null);

  if (error) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  console.log(`  ${profiles.length} profiles missing birthdates\n`);

  // Step 4: Match and update
  let relinked = 0;
  let birthdatesFromReport = 0;
  let birthdatesFromAge = 0;
  let matchedByPhone = 0;
  let matchedByName = 0;
  let noMatch = 0;
  let noBirthday = 0;
  let errors = 0;

  for (const profile of profiles) {
    // Try to find the current Arbox user for this profile
    const profilePhone = normalizePhone(profile.phone);
    let arboxMatch: ArboxUser | undefined;
    let matchMethod = "";

    // Priority 1: Phone match
    if (profilePhone) {
      arboxMatch = arboxByPhone.get(profilePhone);
      if (arboxMatch) matchMethod = "phone";
    }

    // Priority 2: Name match (fallback)
    if (!arboxMatch && profile.full_name) {
      arboxMatch = arboxByName.get(normalizeName(profile.full_name));
      if (arboxMatch) matchMethod = "name";
    }

    if (!arboxMatch) {
      noMatch++;
      continue;
    }

    if (matchMethod === "phone") matchedByPhone++;
    else matchedByName++;

    const currentArboxId = profile.arbox_user_id as number | null;
    const newArboxId = arboxMatch.user_id;
    const needsRelink = currentArboxId !== newArboxId;

    // Look up birthday: first from birthday report (exact), then from age (estimated)
    const exactBirthday = arboxBirthdays.get(newArboxId);
    let birthdate: string | null = null;
    let birthdateSource = "";

    if (exactBirthday) {
      birthdate = exactBirthday;
      birthdateSource = "report";
    } else if (
      arboxMatch.age !== null &&
      arboxMatch.age > 0 &&
      arboxMatch.age < 100
    ) {
      const birthYear = CURRENT_YEAR - Math.round(arboxMatch.age);
      birthdate = `${birthYear}-01-01`;
      birthdateSource = "age";
    }

    if (!birthdate && !needsRelink) {
      noBirthday++;
      continue;
    }

    // Build update payload
    const updates: Record<string, unknown> = {};
    if (needsRelink) updates.arbox_user_id = newArboxId;
    if (birthdate) updates.birthdate = birthdate;

    if (Object.keys(updates).length === 0) continue;

    if (dryRun) {
      const parts: string[] = [];
      if (needsRelink)
        parts.push(`relink ${currentArboxId} -> ${newArboxId}`);
      if (birthdate)
        parts.push(`birthdate: ${birthdate} (${birthdateSource})`);
      console.log(
        `[DRY RUN] ${profile.full_name} (${matchMethod}): ${parts.join(", ")}`,
      );
      if (needsRelink) relinked++;
      if (birthdateSource === "report") birthdatesFromReport++;
      if (birthdateSource === "age") birthdatesFromAge++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    if (updateError) {
      console.error(
        `Failed to update ${profile.full_name} (${profile.id}):`,
        updateError,
      );
      errors++;
    } else {
      const parts: string[] = [];
      if (needsRelink) {
        parts.push(`relinked ${currentArboxId} -> ${newArboxId}`);
        relinked++;
      }
      if (birthdate) {
        parts.push(`birthdate: ${birthdate} (${birthdateSource})`);
        if (birthdateSource === "report") birthdatesFromReport++;
        else birthdatesFromAge++;
      }
      console.log(`Updated ${profile.full_name}: ${parts.join(", ")}`);
    }
  }

  console.log("\n--- Results ---");
  console.log(`Matched by phone: ${matchedByPhone}`);
  console.log(`Matched by name:  ${matchedByName}`);
  console.log(`No match in Arbox: ${noMatch}`);
  console.log(`Arbox IDs re-linked: ${relinked}`);
  console.log(`Birthdates from report (exact): ${birthdatesFromReport}`);
  console.log(`Birthdates from age (estimated Jan 1): ${birthdatesFromAge}`);
  console.log(`No birthday data in Arbox: ${noBirthday}`);
  console.log(`Errors: ${errors}`);

  if (!dryRun && (birthdatesFromReport + birthdatesFromAge) > 0) {
    console.log(
      "\nBenchmarks will be recalculated automatically by DB triggers.",
    );
  }
}

main();
