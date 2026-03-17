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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, arbox_user_id")
    .eq("role", "trainee")
    .is("birthdate", null)
    .limit(15);

  let first = true;
  for (const profile of profiles ?? []) {
    const phone = normalizePhone(profile.phone);
    if (!phone) continue;
    const match = byPhone.get(phone);
    if (!match) continue;
    console.log(`${profile.full_name}: age=${match.age}, birthday=${(match as Record<string,unknown>).birthday ?? "N/A"}, gender=${match.gender}`);
    if (first) {
      console.log(`  ALL KEYS: ${Object.keys(match).join(", ")}`);
      first = false;
    }
  }
}

main();
