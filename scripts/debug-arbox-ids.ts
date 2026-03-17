import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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
const apiKey = process.env.ARBOX_API_KEY as string;

async function main() {
  // Fetch first page from Arbox
  const url = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=1&limit=5`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  const json = await res.json();

  console.log("Arbox API user_id range:");
  for (const u of json.data.slice(0, 5)) {
    console.log(`  user_id: ${u.user_id}, name: ${u.name}, age: ${u.age}`);
  }

  // DB arbox_user_id range
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("arbox_user_id, full_name")
    .not("arbox_user_id", "is", null)
    .is("birthdate", null)
    .limit(5);

  console.log("\nDB arbox_user_id range:");
  for (const p of profiles ?? []) {
    console.log(`  arbox_user_id: ${p.arbox_user_id}, name: ${p.full_name}`);
  }

  // Try matching by name instead
  const arboxByName = new Map<string, { user_id: number; age: number | null }>();
  // Fetch all arbox users
  let page = 1;
  const allArbox: Array<{ user_id: number; name: string; age: number | null }> = [];
  while (page <= 50) {
    const pageUrl = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=${page}&limit=500`;
    const pageRes = await fetch(pageUrl, {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    const pageJson = await pageRes.json();
    allArbox.push(...pageJson.data);
    if (pageJson.data.length < 500) break;
    page++;
  }

  for (const u of allArbox) {
    const normalized = (u.name || "").trim().toLowerCase();
    if (normalized) arboxByName.set(normalized, { user_id: u.user_id, age: u.age });
  }

  console.log("\nName matching test (first 10 profiles):");
  const { data: allMissing } = await supabase
    .from("profiles")
    .select("arbox_user_id, full_name")
    .not("arbox_user_id", "is", null)
    .is("birthdate", null)
    .limit(10);

  for (const p of allMissing ?? []) {
    const normalized = (p.full_name || "").trim().toLowerCase();
    const match = arboxByName.get(normalized);
    console.log(`  ${p.full_name} -> ${match ? `age ${match.age}` : "NO NAME MATCH"}`);
  }
}

main();
