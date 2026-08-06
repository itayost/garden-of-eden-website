/**
 * Verify post-migration state for לידור חי זינטי and דניאל קמרט April 2026 shifts.
 * Read-only.
 *
 * Usage: npx tsx scripts/verify-shift-changes.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const IL_TZ = "Asia/Jerusalem";

let failures = 0;

function fail(message: string): string {
  failures++;
  return message;
}

/** Israel-local YYYY-MM-DD. UTC bucketing shifts night shifts (00:00-02:59
 * Israel time) to the previous day and produces spurious mismatches. */
function ilDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: IL_TZ });
}

function fmtIL(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    timeZone: IL_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationHM(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

async function findTrainer(pattern: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .ilike("full_name", pattern)
    .in("role", ["trainer", "admin"])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Trainer not found for pattern: ${pattern}`);
  return data;
}

async function getShifts(trainerId: string, fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from("trainer_shifts")
    .select("start_time, end_time")
    .eq("trainer_id", trainerId)
    .gte("start_time", `${fromDate}T00:00:00+03:00`)
    .lt("start_time", `${toDate}T00:00:00+03:00`)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function main() {
  console.log("=".repeat(80));
  console.log("VERIFICATION: April 2026 shift changes");
  console.log("=".repeat(80));

  // Lidor: verify late-April shifts (23, 26, 27, 28, 29)
  console.log("\n[1] לידור חי זינטי - late April shifts (23, 26, 27, 28, 29)");
  const lidor = await findTrainer("%לידור%זינטי%");
  console.log(`    Trainer: ${lidor.full_name} (${lidor.id})`);

  const lidorShifts = await getShifts(lidor.id, "2026-04-23", "2026-04-30");
  const expectedLidor: Record<string, string> = {
    "2026-04-23": "7h 0m",
    "2026-04-26": "8h 0m",
    "2026-04-27": "5h 0m",
    "2026-04-28": "1h 0m",
    "2026-04-29": "3h 0m",
  };

  for (const s of lidorShifts) {
    const day = ilDate(s.start_time);
    const dur = durationHM(s.start_time, s.end_time);
    const expected = expectedLidor[day];
    const ok = expected === dur ? "OK" : fail(`FAIL expected ${expected}`);
    console.log(`    ${fmtIL(s.start_time)} -> ${fmtIL(s.end_time)}  (${dur})  ${ok}`);
  }

  const lidorDays = new Set(lidorShifts.map((s) => ilDate(s.start_time)));
  for (const expectedDay of Object.keys(expectedLidor)) {
    if (!lidorDays.has(expectedDay)) {
      console.log(fail(`    FAIL MISSING shift on ${expectedDay}`));
    }
  }

  // Daniel: verify 3.4 (extended +40m) and 29.4 (16:20-20:00)
  console.log("\n[2] דניאל קמרט - 3.4 (extended +40m) and 29.4 (16:20-20:00)");
  const daniel = await findTrainer("%דניאל%קמרט%");
  console.log(`    Trainer: ${daniel.full_name} (${daniel.id})`);

  const danielApr3 = await getShifts(daniel.id, "2026-04-03", "2026-04-04");
  console.log(`    -- 3.4 shifts --`);
  for (const s of danielApr3) {
    console.log(
      `    ${fmtIL(s.start_time)} -> ${fmtIL(s.end_time)}  (${durationHM(s.start_time, s.end_time)})`
    );
  }

  const danielApr29 = await getShifts(daniel.id, "2026-04-29", "2026-04-30");
  console.log(`    -- 29.4 shifts (expect 16:20-20:00, 3h 40m) --`);
  for (const s of danielApr29) {
    const dur = durationHM(s.start_time, s.end_time);
    const ok = dur === "3h 40m" ? "OK" : fail("FAIL");
    console.log(
      `    ${fmtIL(s.start_time)} -> ${fmtIL(s.end_time)}  (${dur})  ${ok}`
    );
  }

  console.log("\n" + "=".repeat(80));
  if (failures > 0) {
    console.log(`FAILED: ${failures} check(s) did not match.`);
    process.exit(1);
  }
  console.log("Done. All checks passed.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
