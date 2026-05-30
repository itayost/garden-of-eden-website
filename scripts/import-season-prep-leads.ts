/**
 * Import the "הכנה לעונה" season-prep call list into the leads table, under the
 * "הכנה לעונה" tab. Sellers are mapped to their trainer profile, the status text
 * is stored as the note, phoneless rows recover their number from a matching
 * trainee profile, and rows that still have no number are inserted as name-only
 * leads (leads.phone is nullable).
 *
 * Usage:
 *   npx tsx scripts/import-season-prep-leads.ts            # dry run (default)
 *   npx tsx scripts/import-season-prep-leads.ts --apply    # perform the insert
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import Papa from "papaparse";

// ── ENV ──────────────────────────────────────────────
const envContent = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  val = val.replace(/\\n$/g, "");
  env[key] = val;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CONFIG ───────────────────────────────────────────
const CSV_PATH = "הכנה לעונה 2026 - למי עוד צריך למכור.csv";
const TAB_ID = "144cb6d6-73f7-41e6-a9d9-60a3fce01706"; // "הכנה לעונה"
const SOURCE = "organic";
const SKIPPED_LOG = "scripts/season-prep-import-skipped.csv";
const apply = process.argv.includes("--apply");

const SELLER_TO_TRAINER_NAME: Record<string, string> = {
  דין: "דין לוי",
  נדב: "נדב דטנר",
  לידור: "לידור חי זינטי",
  דניאל: "דניאל קמרט",
};

// ── HELPERS ──────────────────────────────────────────
function normalizeLeadPhone(phone: string): string | null {
  const clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("05") && clean.length === 10) return "972" + clean.slice(1);
  if (clean.startsWith("5") && clean.length === 9) return "972" + clean;
  if (clean.startsWith("972") && clean.length === 12) return clean;
  return null;
}

function normName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

interface LeadRecord {
  phone: string | null;
  name: string;
  tab_id: string;
  source: string;
  status: string;
  is_from_haifa: boolean;
  note: string | null;
  assigned_trainer_id: string | null;
}

interface SkippedRow {
  name: string;
  phone: string;
  reason: string;
}

// ── MAIN ─────────────────────────────────────────────
async function main() {
  console.log(`\n=== Import season-prep leads ${apply ? "(APPLY)" : "(DRY RUN)"} ===\n`);

  // 1. seller -> trainer id
  const { data: trainers, error: trainersErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("full_name", Object.values(SELLER_TO_TRAINER_NAME));
  if (trainersErr) throw trainersErr;
  const trainerIdByName = new Map<string, string>(
    (trainers ?? []).map((t) => [t.full_name as string, t.id as string])
  );
  const sellerToTrainerId = (seller: string): string | null => {
    const fullName = SELLER_TO_TRAINER_NAME[seller];
    return fullName ? trainerIdByName.get(fullName) ?? null : null;
  };

  // 2. profile name -> phone (for phoneless recovery)
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .not("phone", "is", null);
  if (profilesErr) throw profilesErr;
  const profilePhoneByName = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (!p.full_name || !p.phone) continue;
    const n = normName(p.full_name as string);
    const ph = normalizeLeadPhone(p.phone as string) ?? (p.phone as string);
    if (!profilePhoneByName.has(n)) profilePhoneByName.set(n, ph);
  }

  // 3. existing leads (skip duplicates, never touch existing rows)
  const { data: existingLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("phone, name");
  if (leadsErr) throw leadsErr;
  const existingPhones = new Set<string>(
    (existingLeads ?? []).filter((l) => l.phone).map((l) => l.phone as string)
  );
  const existingNames = new Set<string>(
    (existingLeads ?? []).map((l) => normName(l.name as string))
  );

  // 4. parse CSV
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = Papa.parse<string[]>(raw, { skipEmptyLines: false }).data;

  const phonedInserts = new Map<string, LeadRecord>(); // phone -> record
  const phonedNames = new Set<string>();
  const nameOnlyInserts = new Map<string, LeadRecord>(); // normName -> record
  const skipped: SkippedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    let name = normName(r[0] || "");
    const col2 = (r[1] || "").trim();
    const seller = (r[3] || "").trim();
    const status = (r[4] || "").trim();

    name = name.replace(/^\d+\.\s*/, "").trim();

    // embedded "name - phone" when the phone column is empty
    let phoneRaw = col2;
    if (!normalizeLeadPhone(col2)) {
      const m = name.match(/^(.*?)\s*[-–]\s*(\d[\d\s]{6,})$/);
      if (m) {
        name = normName(m[1]);
        phoneRaw = m[2];
      }
    }

    if (!name) continue; // separator row
    if (name === "שם") continue; // stray header row

    const trainerId = sellerToTrainerId(seller);
    const noteParts: string[] = [];
    if (status) noteParts.push(status);
    if (seller && !(seller in SELLER_TO_TRAINER_NAME)) noteParts.push(seller);
    const note = noteParts.join(" | ") || null;

    let phone = normalizeLeadPhone(phoneRaw);
    if (!phone) phone = profilePhoneByName.get(name) ?? null; // recover from profile

    const record: LeadRecord = {
      phone,
      name,
      tab_id: TAB_ID,
      source: SOURCE,
      status: "new",
      is_from_haifa: false,
      note,
      assigned_trainer_id: trainerId,
    };

    if (phone) {
      if (existingPhones.has(phone)) {
        skipped.push({ name, phone, reason: "already a lead" });
        continue;
      }
      if (phonedInserts.has(phone)) {
        skipped.push({ name, phone, reason: "duplicate phone in CSV" });
        continue;
      }
      phonedInserts.set(phone, record);
      phonedNames.add(name);
    } else {
      if (existingNames.has(name)) {
        skipped.push({ name, phone: "", reason: "name already a lead" });
        continue;
      }
      if (phonedNames.has(name) || nameOnlyInserts.has(name)) {
        skipped.push({ name, phone: "", reason: "duplicate name in CSV" });
        continue;
      }
      nameOnlyInserts.set(name, record);
    }
  }

  const phonedRecords = [...phonedInserts.values()];
  const nameOnlyRecords = [...nameOnlyInserts.values()];
  const inserts = [...phonedRecords, ...nameOnlyRecords];

  // skipped log (BOM for Hebrew in Excel)
  fs.writeFileSync(SKIPPED_LOG, "﻿" + Papa.unparse(skipped), "utf8");

  // ── Summary ──
  console.log(`Trainers resolved: ${trainerIdByName.size}/4`);
  console.log(`Profiles with phone (for recovery): ${profilePhoneByName.size}`);
  console.log(`Existing leads: ${existingPhones.size} phones, ${existingNames.size} names\n`);
  console.log(`Will insert (phoned):     ${phonedRecords.length}`);
  console.log(`Will insert (name-only):  ${nameOnlyRecords.length}`);
  console.log(`Total to insert:          ${inserts.length}`);
  console.log(`Skipped:                  ${skipped.length}  (logged to ${SKIPPED_LOG})`);

  const byReason = skipped.reduce<Record<string, number>>((acc, s) => {
    acc[s.reason] = (acc[s.reason] ?? 0) + 1;
    return acc;
  }, {});
  console.log("  skip reasons:", JSON.stringify(byReason));

  const byTrainer = inserts.reduce<Record<string, number>>((acc, r) => {
    const key = r.assigned_trainer_id ?? "(none)";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log("  inserts by trainer id:", JSON.stringify(byTrainer));

  if (!apply) {
    console.log("\n(Dry run - no changes made. Re-run with --apply to insert.)");
    return;
  }

  // ── Insert in batches ──
  console.log("\n--- Inserting ---");
  let inserted = 0;
  const BATCH = 100;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    const { error } = await supabase.from("leads").insert(batch);
    if (error) {
      console.error(`  Batch ${i / BATCH + 1} FAILED:`, error.message);
      throw error;
    }
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${inserts.length}`);
  }

  console.log(`\nDone! Inserted ${inserted} leads into the "הכנה לעונה" tab.`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
