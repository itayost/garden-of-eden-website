/**
 * One-off script: Backfill birthdays from Arbox into profiles.birthdate.
 *
 * Usage: npx tsx scripts/arbox-sync-birthdays.ts
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

type BirthdayEntry = {
  user_id: number;
  name: string;
  birthday: string | null;
};

type BirthdayResponse = {
  statusCode: number;
  data: BirthdayEntry[];
  extra: { pagination: { total: number; total_pages: number } };
};

async function fetchBirthdayPage(
  apiKey: string,
  fromDate: string,
  toDate: string,
  page: number,
): Promise<BirthdayEntry[]> {
  const url = `${BASE_URL}/reports/birthdayReport?group_by=user&reportName=birthdayReport&fromDate=${fromDate}&toDate=${toDate}&page=${page}&limit=500`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Arbox API error: ${res.status}`);
  const json: BirthdayResponse = await res.json();
  return json.data ?? [];
}

async function fetchAllBirthdays(apiKey: string): Promise<Map<number, string>> {
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
    while (page <= 50) {
      const entries = await fetchBirthdayPage(apiKey, from, to, page);
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

async function main() {
  const apiKey = process.env.ARBOX_API_KEY || process.argv[2];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    console.error("Missing ARBOX_API_KEY. Pass as: npx tsx scripts/arbox-sync-birthdays.ts <ARBOX_API_KEY>");
    process.exit(1);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("Fetching birthdays from Arbox (12 months)...");
  const birthdays = await fetchAllBirthdays(apiKey);
  console.log(`Found ${birthdays.size} birthdays in Arbox`);

  // Fetch profiles linked to Arbox with missing birthdate
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, arbox_user_id, full_name")
    .not("arbox_user_id", "is", null)
    .is("birthdate", null);

  if (error) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  console.log(`${profiles.length} profiles linked to Arbox with missing birthdate`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles) {
    const birthday = birthdays.get(profile.arbox_user_id as number);
    if (!birthday) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ birthdate: birthday })
      .eq("id", profile.id);

    if (updateError) {
      console.error(`Failed to update ${profile.full_name} (${profile.id}):`, updateError);
      errors++;
    } else {
      console.log(`Updated ${profile.full_name}: ${birthday}`);
      updated++;
    }
  }

  console.log("\n--- Results ---");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no birthday in Arbox): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main();
