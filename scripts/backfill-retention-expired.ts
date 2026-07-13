/**
 * Backfill members missing from past retention_reports snapshots.
 *
 * Why they are missing: Arbox's expiring* reports only return memberships whose
 * end_date is still in the future. Until the merge fix (8f3f9bf, 2026-06-18) the
 * daily 04:00 cron REPLACED the current month's snapshot with a fresh pull, so
 * every night it deleted the members who had expired since the 1st. March was
 * never complete either: the feature launched 2026-03-22, so its first three
 * weeks were never captured.
 *
 * Source: expiredMembershipsReport + expiredSessionsReport, the backward-looking
 * twins. Verified to include members who expired and then RENEWED
 * (client_status: active), so the reconstruction is not biased toward churn.
 *
 * ADDITIVE ONLY. Existing entries always win. This script can only add members.
 * It cannot go through persistRetentionReport(), which throws on past months by
 * design, so it writes the table directly with the admin client.
 *
 * Usage:
 *   npx tsx scripts/backfill-retention-expired.ts            # dry run
 *   npx tsx scripts/backfill-retention-expired.ts --apply    # write
 *   npx tsx scripts/backfill-retention-expired.ts --month 2026-06-01 --apply
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";
import {
  buildBackfillFromExpired,
  fetchExpiredMemberships,
  fetchExpiredSessions,
  type DroppedRow,
} from "../src/lib/arbox/expired";
import {
  buildBookingIndex,
  entryIdentity,
  fetchBookingsReport,
  getAttendanceMonthKeys,
  getAttendanceMonthRanges,
  mergeRetentionReports,
  type BookingEntry,
  type RetentionEntry,
  type RetentionReportData,
} from "../src/lib/arbox/retention";

const ALL_MONTHS = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];

const APPLY = process.argv.includes("--apply");

/** yyyy-mm-01, matching one of ALL_MONTHS. */
const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

function resolveMonths(): readonly string[] {
  const idx = process.argv.indexOf("--month");
  if (idx === -1) return ALL_MONTHS;

  const value = process.argv[idx + 1];
  if (!value || !MONTH_PATTERN.test(value) || !ALL_MONTHS.includes(value)) {
    throw new Error(
      `--month must be one of ${ALL_MONTHS.join(", ")} (got ${value ?? "<missing>"}). ` +
        `Refusing to silently fall back to all months.`,
    );
  }
  return [value];
}

const MONTHS = resolveMonths();

const EMPTY: RetentionReportData = { monthly: [], pro: [], training_card: [] };

/** Arbox rate-limits per key. Space the calls out. */
const PAUSE_MS = 1500;
const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

function lastDayOf(reportMonth: string): string {
  const d = new Date(reportMonth + "T00:00:00");
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

/**
 * Defensive `?? []` on every category, matching mergeRetentionReports: a
 * stored row written by an older shape (or hand-edited) could be missing a
 * category key, and this must not throw before the backup is written.
 */
function allEntries(data: RetentionReportData): readonly RetentionEntry[] {
  return [
    ...(data.monthly ?? []),
    ...(data.pro ?? []),
    ...(data.training_card ?? []),
  ];
}

function total(data: RetentionReportData): number {
  return allEntries(data).length;
}

function earliestEndDate(data: RetentionReportData): string {
  const ends = allEntries(data)
    .map((e) => e.end_date)
    .filter(Boolean)
    .sort();
  return ends[0] ?? "-";
}

async function backfillMonth(
  supabase: ReturnType<typeof getAdminClient>,
  reportMonth: string,
  backupDir: string,
  stamp: string,
): Promise<readonly DroppedRow[]> {
  console.log(`\n${"=".repeat(60)}\n${reportMonth}\n${"=".repeat(60)}`);

  // 1) Read the stored snapshot.
  const { data: row, error: readErr } = await supabase
    .from("retention_reports")
    .select("report_month, data, created_at")
    .eq("report_month", reportMonth)
    .maybeSingle();

  if (readErr) {
    throw new Error(`read ${reportMonth} failed: ${readErr.message}`);
  }

  const stored = ((row as { data?: RetentionReportData } | null)?.data ??
    EMPTY) as RetentionReportData;
  const createdAt = (row as { created_at?: string } | null)?.created_at ?? null;

  console.log(
    `stored: n=${total(stored)}  earliest_end=${earliestEndDate(stored)}`,
  );

  // 2) Back the row up before touching anything. If no row exists yet, the
  // backup file holds `null` — restoring that is not a rollback (it would
  // not delete the row an upsert is about to insert), so the rollback
  // instructions differ below.
  const rowExisted = row != null;
  const backupPath = path.join(
    backupDir,
    `retention-backfill-${reportMonth}-${stamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(row ?? null, null, 2));
  console.log(`backup: ${backupPath}`);
  const rollbackInstructions = rowExisted
    ? `Rollback: ${backupPath}`
    : `Rollback: DELETE FROM retention_reports WHERE report_month = '${reportMonth}'`;

  // 3) Pull both expired reports for the month. Serialized: Arbox rate-limits.
  const to = lastDayOf(reportMonth);
  const memberships = await fetchExpiredMemberships(reportMonth, to);
  await pause();
  const sessions = await fetchExpiredSessions(reportMonth, to);
  await pause();

  const expired = [...memberships, ...sessions];
  console.log(
    `arbox: memberships=${memberships.length} sessions=${sessions.length} (before end_date filter)`,
  );

  // 4) Attendance for the report month plus the three before it.
  const bookings: BookingEntry[] = [];
  for (const { from, to: rangeTo } of getAttendanceMonthRanges(reportMonth)) {
    const chunk = await fetchBookingsReport(from, rangeTo);
    bookings.push(...chunk);
    await pause();
  }
  const bookingIndex = buildBookingIndex(bookings);

  // 5) Build.
  const { data: backfill, dropped } = buildBackfillFromExpired(
    reportMonth,
    expired,
    bookingIndex,
    getAttendanceMonthKeys(reportMonth),
  );
  console.log(`built:  n=${total(backfill)} (end_date inside ${reportMonth.slice(0, 7)})`);

  // 6) Merge, ADDITIVELY.
  //
  // mergeRetentionReports(stored, fresh) lets `fresh` win on an identity
  // collision. We want the EXISTING snapshot to win, so it goes in the `fresh`
  // slot and the backfill goes in the `stored` slot. The backfill can then only
  // contribute members that are genuinely absent. Do not swap these.
  const merged = mergeRetentionReports(backfill, stored);

  // Prove the merge is additive rather than counting a net delta. dedupAndSort
  // collapses same-identity entries within a category, so if the STORED
  // snapshot itself already contains a same-identity duplicate (reachable via
  // buildRetentionReport(), which does not dedupe, or a verbatim-upserted
  // restore), the merge can silently drop one of them. A net count would miss
  // (or misreport) that: -2 falls through the `!== 0` write gate and writes a
  // smaller snapshot; +4 masks a hidden -1. Compare identity SETS instead and
  // refuse to write anything that would remove a stored entry.
  const storedIds = new Set(allEntries(stored).map(entryIdentity));
  const mergedIds = new Set(allEntries(merged).map(entryIdentity));
  const removed = [...storedIds].filter((id) => !mergedIds.has(id));
  if (removed.length > 0) {
    throw new Error(
      `${reportMonth}: merge would REMOVE ${removed.length} stored entries (${removed.join(", ")}). ` +
        `Refusing to write. This means the stored snapshot contains duplicate identities.`,
    );
  }
  const addedEntries = allEntries(merged).filter(
    (e) => !storedIds.has(entryIdentity(e)),
  );

  console.log(
    `merged: n=${total(merged)}  earliest_end=${earliestEndDate(merged)}  ADDED=${addedEntries.length}`,
  );

  if (addedEntries.length > 0) {
    console.log("added members:");
    for (const e of addedEntries) {
      console.log(
        `  ${e.end_date}  ${e.name}  (${e.membership_type_name ?? "-"})`,
      );
    }
  }

  if (dropped.length > 0) {
    console.log(`unmapped membership types (NOT backfilled): ${dropped.length}`);
    for (const d of dropped) {
      console.log(`  ${d.end_date}  ${d.name}  "${d.membership_type_name}"`);
    }
  }

  // 7) Write.
  if (!APPLY) {
    console.log("dry run, no write");
    return dropped;
  }

  if (addedEntries.length === 0) {
    console.log("nothing to add, skipping write");
    return dropped;
  }

  const upsertRow: Record<string, unknown> = {
    report_month: reportMonth,
    data: merged as unknown as Record<string, unknown>,
  };
  // Preserve the original snapshot timestamp so the row still reads as that
  // month's snapshot rather than as something built today.
  if (createdAt) upsertRow.created_at = createdAt;

  const { error: upErr } = await supabase
    .from("retention_reports")
    .upsert(upsertRow, { onConflict: "report_month" });

  if (upErr) throw new Error(`upsert ${reportMonth} failed: ${upErr.message}`);

  console.log(`WROTE ${reportMonth}. ${rollbackInstructions}`);
  return dropped;
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.ARBOX_API_KEY) {
    throw new Error("ARBOX_API_KEY is not set");
  }

  const supabase = getAdminClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN");

  const allDropped: DroppedRow[] = [];
  for (const month of MONTHS) {
    const dropped = await backfillMonth(supabase, month, backupDir, stamp);
    allDropped.push(...dropped);
  }

  console.log(`\n${"=".repeat(60)}\nUNMAPPED MEMBERSHIP TYPES ACROSS ALL MONTHS\n${"=".repeat(60)}`);
  const byType = new Map<string, number>();
  for (const d of allDropped) {
    const key = d.membership_type_name ?? "(null)";
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  if (byType.size === 0) {
    console.log("none");
  } else {
    for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}x  "${type}"`);
    }
    console.log(
      "\nThese members are missing from live reports too. Decide the tab mapping with Eden, then extend getCategoryForMembershipType().",
    );
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write.");
  }
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
