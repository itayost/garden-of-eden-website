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

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/(?!^\+)\D/g, "");
  if (cleaned.startsWith("+972") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("972") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+972" + cleaned.slice(1);
  return null;
}

async function main() {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (page <= 50) {
    const url = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=${page}&limit=500`;
    const res = await fetch(url, { headers: { "api-key": apiKey, Accept: "application/json" } });
    const json = await res.json();
    all.push(...json.data);
    if (json.data.length < 500) break;
    page++;
  }

  const byPhone = new Map<string, Record<string, unknown>>();
  for (const u of all) {
    const p = normalizePhone(u.phone as string);
    if (p) byPhone.set(p, u);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );

  // Trainees WITH birthdates
  const { data: withBD } = await supabase
    .from("profiles")
    .select("full_name, phone, birthdate")
    .eq("role", "trainee")
    .not("birthdate", "is", null)
    .limit(10);

  console.log("Trainees WITH birthdates - do they have age in Arbox?");
  for (const p of withBD ?? []) {
    const phone = normalizePhone(p.phone);
    const match = phone ? byPhone.get(phone) : undefined;
    console.log(`  ${p.full_name}: birthdate=${p.birthdate}, arbox_age=${match?.age ?? "NO MATCH"}`);
  }

  // Count: how many with birthdates have age in Arbox?
  const { data: allWithBD } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("role", "trainee")
    .not("birthdate", "is", null);

  let hasAge = 0;
  let noAge = 0;
  let noArboxMatch = 0;
  for (const p of allWithBD ?? []) {
    const phone = normalizePhone(p.phone);
    const match = phone ? byPhone.get(phone) : undefined;
    if (!match) { noArboxMatch++; continue; }
    if (match.age !== null && (match.age as number) > 0) hasAge++;
    else noAge++;
  }
  console.log(`\nTrainees WITH birthdates: ${(allWithBD ?? []).length}`);
  console.log(`  Arbox has age: ${hasAge}`);
  console.log(`  Arbox age null: ${noAge}`);
  console.log(`  No Arbox match: ${noArboxMatch}`);
}

main();
