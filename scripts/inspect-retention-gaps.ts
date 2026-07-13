/**
 * READ-ONLY. Prints the earliest end_date present in each retention snapshot.
 * That date is the gap marker: a month whose earliest end_date is the 18th is
 * missing everyone who expired on the 1st through the 17th. Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-retention-gaps.ts
 */
import { loadEnvLocal, getAdminClient } from "./import-utils";

interface Entry {
  end_date: string;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("retention_reports")
    .select("report_month, data")
    .order("report_month");

  if (error) {
    console.error("select error:", error.message);
    process.exit(1);
  }

  console.log("month       |   n | earliest_end | latest_end");
  console.log("------------|-----|--------------|-----------");

  for (const row of (data ?? []) as {
    report_month: string;
    data: Record<string, Entry[]> | null;
  }[]) {
    const d = row.data;
    const ends = [
      ...(d?.monthly ?? []),
      ...(d?.pro ?? []),
      ...(d?.training_card ?? []),
    ]
      .map((e) => e.end_date)
      .filter(Boolean)
      .sort();

    console.log(
      `${row.report_month} | ${String(ends.length).padStart(3)} | ${(ends[0] ?? "-").padEnd(12)} | ${ends[ends.length - 1] ?? "-"}`,
    );
  }
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
