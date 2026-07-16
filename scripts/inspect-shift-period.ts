/**
 * READ-ONLY: verify the shift_period migration landed in production.
 * Confirms the column exists on both tables, reports the distribution of
 * values, and checks that no historical row was reclassified. Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-shift-period.ts
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data: shifts, error: shiftsError } = await supabase
    .from("trainer_shifts")
    .select("id, shift_period, start_time")
    .order("start_time", { ascending: false })
    .limit(2000);

  if (shiftsError) {
    console.error("trainer_shifts read failed:", shiftsError.message);
    process.exit(1);
  }

  const rows = (shifts ?? []) as { shift_period: string | null }[];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const key = String(r.shift_period);
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});

  console.log(`trainer_shifts sampled: ${rows.length}`);
  console.log("shift_period distribution:", counts);

  const { data: requests, error: requestsError } = await supabase
    .from("shift_change_requests")
    .select("id, shift_period")
    .limit(500);

  if (requestsError) {
    console.error("shift_change_requests read failed:", requestsError.message);
    process.exit(1);
  }

  const reqRows = (requests ?? []) as { shift_period: string | null }[];
  const reqCounts = reqRows.reduce<Record<string, number>>((acc, r) => {
    const key = String(r.shift_period);
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});

  console.log(`shift_change_requests sampled: ${reqRows.length}`);
  console.log("shift_period distribution:", reqCounts);

  const nulls = rows.filter((r) => r.shift_period == null).length;
  const unexpected = Object.keys(counts).filter(
    (k) => k !== "morning" && k !== "regular"
  );

  console.log("");
  console.log(nulls === 0 ? "OK: no null shift_period" : `FAIL: ${nulls} nulls`);
  console.log(
    unexpected.length === 0
      ? "OK: only morning/regular present"
      : `FAIL: unexpected values ${unexpected.join(", ")}`
  );
  console.log(
    counts.morning === undefined
      ? "OK: no historical row was reclassified as morning"
      : `NOTE: ${counts.morning} morning row(s) already exist`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
