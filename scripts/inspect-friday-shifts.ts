/**
 * READ-ONLY: report how real Friday shifts are distributed against a proposed
 * 09:00-15:00 window, so we know what hard enforcement would reject.
 * Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-friday-shifts.ts
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";

const TZ = "Asia/Jerusalem";

function israelParts(iso: string): { dow: number; minutes: number; hhmm: string } {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  return {
    dow: map[get("weekday")] ?? -1,
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("trainer_shifts")
    .select("id, trainer_name, start_time, end_time")
    .not("end_time", "is", null)
    .order("start_time", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("read failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as {
    trainer_name: string;
    start_time: string;
    end_time: string;
  }[];

  const fridays = rows.filter((r) => israelParts(r.start_time).dow === 5);

  console.log(`closed shifts sampled: ${rows.length}`);
  console.log(`Friday shifts: ${fridays.length}`);
  console.log("");

  const START = 9 * 60;
  const END = 15 * 60;

  const early = fridays.filter((r) => israelParts(r.start_time).minutes < START);
  const late = fridays.filter((r) => israelParts(r.end_time).minutes > END);
  const wouldInferMorning = fridays.filter((r) => {
    const m = israelParts(r.start_time).minutes;
    return m >= 8 * 60 && m < 11 * 60;
  });

  console.log(`start before 09:00: ${early.length}`);
  early.slice(0, 8).forEach((r) =>
    console.log(
      `   ${r.trainer_name}: ${israelParts(r.start_time).hhmm}-${israelParts(r.end_time).hhmm}`
    )
  );

  console.log(`end after 15:00: ${late.length}`);
  late.slice(0, 8).forEach((r) =>
    console.log(
      `   ${r.trainer_name}: ${israelParts(r.start_time).hhmm}-${israelParts(r.end_time).hhmm}`
    )
  );

  console.log("");
  console.log(
    `Friday shifts the CURRENT deployed inference would mislabel 'morning' ` +
      `(start in 08:00-10:59): ${wouldInferMorning.length}`
  );
  wouldInferMorning.slice(0, 10).forEach((r) =>
    console.log(
      `   ${r.trainer_name}: ${israelParts(r.start_time).hhmm}-${israelParts(r.end_time).hhmm}` +
        ` <- would be force-ended at 11:00`
    )
  );

  const startHist = fridays.reduce<Record<string, number>>((acc, r) => {
    const h = israelParts(r.start_time).hhmm.slice(0, 2);
    return { ...acc, [h]: (acc[h] ?? 0) + 1 };
  }, {});
  console.log("");
  console.log("Friday start-hour histogram:", startHist);

  const endHist = fridays.reduce<Record<string, number>>((acc, r) => {
    const h = israelParts(r.end_time).hhmm.slice(0, 2);
    return { ...acc, [h]: (acc[h] ?? 0) + 1 };
  }, {});
  console.log("Friday end-hour histogram:  ", endHist);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
