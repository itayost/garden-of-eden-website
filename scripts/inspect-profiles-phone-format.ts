/**
 * READ-ONLY: report the distribution of profiles.phone formats and the current
 * state of the recently-cleaned trainee batch. Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-profiles-phone-format.ts
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";
import { normalizePhone } from "../src/lib/arbox/normalize-phone";

function bucket(phone: string | null): string {
  if (!phone) return "(null)";
  if (phone.startsWith("+972")) return "+972... (E.164)";
  if (phone.startsWith("972")) return "972... (bare)";
  if (phone.startsWith("05")) return "05... (local)";
  if (phone.startsWith("0")) return "0... (other local)";
  return "other";
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  // Pull all active profiles' phone + a few flags (no row cap: paginate).
  const all: {
    phone: string | null;
    full_name: string | null;
    arbox_user_id: number | null;
    role: string;
  }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("phone, full_name, arbox_user_id, role")
      .is("deleted_at", null)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("select error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as typeof all));
    if (data.length < PAGE) break;
  }

  console.log(`Active profiles: ${all.length}\n`);

  // Overall format distribution.
  const dist = new Map<string, number>();
  for (const p of all) dist.set(bucket(p.phone), (dist.get(bucket(p.phone)) ?? 0) + 1);
  console.log("=== profiles.phone format distribution (active) ===");
  for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  // Trainees only.
  const trainees = all.filter((p) => p.role === "trainee");
  const tDist = new Map<string, number>();
  for (const p of trainees) tDist.set(bucket(p.phone), (tDist.get(bucket(p.phone)) ?? 0) + 1);
  console.log(`\n=== trainee profiles.phone (${trainees.length}) ===`);
  for (const [k, v] of [...tDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  // arbox_user_id coverage among 05-local trainees (the batch I just changed).
  const localTrainees = trainees.filter((p) => p.phone && p.phone.startsWith("05"));
  const withArbox = localTrainees.filter((p) => p.arbox_user_id != null).length;
  console.log(`\n=== 05-local trainees (the recently-cleaned batch) ===`);
  console.log(`  count:                 ${localTrainees.length}`);
  console.log(`  with arbox_user_id:    ${withArbox}`);
  console.log(
    `  named now:             ${
      localTrainees.filter((p) => p.full_name && p.full_name.trim()).length
    }`
  );

  // --- Simulate canonicalize-to-+972 across the whole active table ---
  const canonicalOwners = new Map<string, number>(); // +972 key -> count of rows already at canonical
  for (const p of all) {
    if (p.phone && p.phone.startsWith("+972")) {
      canonicalOwners.set(p.phone, (canonicalOwners.get(p.phone) ?? 0) + 1);
    }
  }

  let wouldChange = 0;
  let unparseable = 0;
  let collisionWithCanonical = 0;
  const intraKey = new Map<string, number>();
  for (const p of all) {
    if (!p.phone || p.phone.startsWith("+972")) continue; // already canonical or null
    const key = normalizePhone(p.phone);
    if (!key) {
      unparseable++;
      continue;
    }
    wouldChange++;
    if (canonicalOwners.has(key)) collisionWithCanonical++;
    intraKey.set(key, (intraKey.get(key) ?? 0) + 1);
  }
  const intraDupRows = [...intraKey.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0);

  console.log(`\n=== Simulate canonicalize non-+972 -> +972 (whole active table) ===`);
  console.log(`  rows that would change:        ${wouldChange}`);
  console.log(`  unparseable (skip):            ${unparseable}`);
  console.log(`  collide with existing +972:    ${collisionWithCanonical}`);
  console.log(`  intra-batch duplicate rows:    ${intraDupRows}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
