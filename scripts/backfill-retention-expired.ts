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
 * expiredSessionsReport does NOT honour its fromDate/toDate range: querying
 * month M's window does not return every card whose end_date falls in M —
 * some rows only surface when a NEIGHBOURING month's window is queried, and
 * filtering can't recover a row the API never returned for a narrow query.
 * A single wide query isn't possible either (Arbox 400s past ~31 days). So
 * fetchAllExpiredEntries() fetches each report exactly ONCE across a series
 * of overlapping monthly windows, unions + dedupes the rows, and every
 * target month buckets its own rows out of that same union. Do not go back
 * to querying per target month — that reproduces the under-collection bug.
 *
 * ADDITIVE ONLY. Existing entries always win. This script can only add members.
 * It cannot go through persistRetentionReport(), which throws on past months by
 * design, so it writes the table directly with the admin client.
 *
 * Two phases, so an --apply run is all-or-nothing across months:
 *   PHASE 1 (always runs): fetch the expired-entry union once, then read,
 *     build, merge, and validate every month against it. No writes happen
 *     here. A throw in any month aborts before anything is written, for any
 *     month.
 *   PHASE 2 (only under --apply, only if phase 1 passed for every month):
 *     write the backup file and upsert, one month at a time.
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
  EXPIRED_FETCH_WINDOWS,
  fetchAllExpiredEntries,
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
  type ExpiringMembershipEntry,
  type RetentionEntry,
  type RetentionReportData,
} from "../src/lib/arbox/retention";
import { normalizePhone } from "../src/lib/arbox/normalize-phone";
import { ARBOX_MAX_PAGES, ARBOX_PAGE_LIMIT } from "../src/lib/arbox/constants";

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
const pause = (): Promise<void> => new Promise((r) => setTimeout(r, PAUSE_MS));

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

/** Which fallback of entryIdentity (uid > phone > name) actually matched. */
function identityScheme(entry: RetentionEntry): "uid" | "phone" | "name" {
  if (entry.user_id != null) return "uid";
  if (normalizePhone(entry.phone)) return "phone";
  return "name";
}

/**
 * Identities that appear more than once within a single category of `data`.
 * dedupAndSort operates per category (not across the whole snapshot), so this
 * mirrors exactly what it would collapse. Returned as `"category:identity(xN)"`
 * strings for direct use in an error message.
 */
function findDuplicateIdentities(data: RetentionReportData): readonly string[] {
  const dupes: string[] = [];
  for (const category of ["monthly", "pro", "training_card"] as const) {
    const counts = new Map<string, number>();
    for (const entry of data[category] ?? []) {
      const id = entryIdentity(entry);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of counts) {
      if (count > 1) dupes.push(`${category}:${id}(x${count})`);
    }
  }
  return dupes;
}

type StoredRow = { report_month: string; data: RetentionReportData; created_at?: string } | null;

interface MonthPlan {
  readonly reportMonth: string;
  readonly rawRow: StoredRow;
  readonly rowExisted: boolean;
  readonly createdAt: string | null;
  readonly stored: RetentionReportData;
  readonly merged: RetentionReportData;
  readonly addedEntries: readonly RetentionEntry[];
  readonly dropped: readonly DroppedRow[];
}

/**
 * PHASE 1 for one month: read the stored snapshot, build the backfill from
 * the already-fetched expired-entry union, merge, and run every invariant
 * check. Pure read + compute — no writes. Throws (aborting the whole run
 * before any month is written) if anything looks unsafe.
 */
async function prepareMonth(
  supabase: ReturnType<typeof getAdminClient>,
  reportMonth: string,
  expired: readonly ExpiringMembershipEntry[],
): Promise<MonthPlan> {
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

  const rawRow = row as StoredRow;
  const stored = (rawRow?.data ?? EMPTY) as RetentionReportData;
  const createdAt = rawRow?.created_at ?? null;
  const rowExisted = rawRow != null;

  console.log(
    `stored: n=${total(stored)}  earliest_end=${earliestEndDate(stored)}`,
  );

  // 2) Attendance for the report month plus the three before it. A truncated
  // pull would freeze UNDERSTATED attendance into history that the nightly
  // cron can never correct, so refuse to build from an incomplete pull rather
  // than warn and continue.
  const bookings: BookingEntry[] = [];
  for (const { from, to: rangeTo } of getAttendanceMonthRanges(reportMonth)) {
    const chunk = await fetchBookingsReport(from, rangeTo);
    const truncationCap = ARBOX_MAX_PAGES * ARBOX_PAGE_LIMIT;
    if (chunk.length >= truncationCap) {
      throw new Error(
        `${reportMonth}: bookingsReport ${from}..${rangeTo} returned ${chunk.length} rows, ` +
          `hitting the ARBOX_MAX_PAGES x ARBOX_PAGE_LIMIT cap (${truncationCap}). ` +
          `Attendance for this range is truncated. Refusing to freeze understated attendance into history.`,
      );
    }
    bookings.push(...chunk);
    await pause();
  }
  const bookingIndex = buildBookingIndex(bookings);

  // 3) Build, bucketing the pre-fetched expired-entry union into this month
  // via isEndDateInMonth (buildBackfillFromExpired does the bucketing).
  const { data: backfill, dropped } = buildBackfillFromExpired(
    reportMonth,
    expired,
    bookingIndex,
    getAttendanceMonthKeys(reportMonth),
  );
  console.log(`built:  n=${total(backfill)} (end_date inside ${reportMonth.slice(0, 7)})`);

  // 4) Merge, ADDITIVELY.
  //
  // mergeRetentionReports(stored, fresh) lets `fresh` win on an identity
  // collision. We want the EXISTING snapshot to win, so it goes in the `fresh`
  // slot and the backfill goes in the `stored` slot. The backfill can then only
  // contribute members that are genuinely absent. Do not swap these.
  const merged = mergeRetentionReports(backfill, stored);

  // Identity-SET check. Cheap, and left in place, but it is NOT the proof of
  // safety below — do not delete the count invariant believing this covers
  // it. dedupAndSort dedupes mergeCategory's input by identity, and every
  // identity in `stored` is part of that input (via the `fresh` slot above),
  // so every stored identity is UNCONDITIONALLY present in `merged`: this set
  // difference can never be non-empty. It cannot detect a stored snapshot
  // that already contains two entries sharing one identity within a
  // category — dedupAndSort collapses those into one, the identity SET is
  // unchanged (it was already in the set once), and this check stays silent
  // while a real member is dropped from history.
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

  // Count invariant. THIS is the real proof of safety: it catches loss of
  // MULTIPLICITY, not just loss of set membership. If `stored` contains two
  // entries with the same entryIdentity in one category (reachable —
  // buildRetentionReport() never dedupes, the pre-merge-fix cron wrote its
  // raw output verbatim, and restore-may-retention.ts upserted a blob
  // verbatim), dedupAndSort silently collapses them into one inside
  // mergeCategory. The identity set is unaffected, so the check above stays
  // silent, but `merged` ends up with one fewer entry than it should.
  const expectedMerged = total(stored) + addedEntries.length;
  if (total(merged) !== expectedMerged) {
    const dupes = findDuplicateIdentities(stored);
    throw new Error(
      `${reportMonth}: merge would COLLAPSE duplicate entries in the stored snapshot ` +
        `(stored=${total(stored)} added=${addedEntries.length} merged=${total(merged)}, ` +
        `expected merged=${expectedMerged}). ` +
        `Duplicate identities: ${dupes.join(", ") || "(none found — investigate)"}. Refusing to write.`,
    );
  }

  console.log(
    `merged: n=${total(merged)}  earliest_end=${earliestEndDate(merged)}  ADDED=${addedEntries.length}`,
  );

  if (addedEntries.length > 0) {
    console.log("added members:");
    const schemeCounts = { uid: 0, phone: 0, name: 0 };
    for (const e of addedEntries) {
      const scheme = identityScheme(e);
      schemeCounts[scheme]++;
      console.log(
        `  ${e.end_date}  ${e.name}  (${e.membership_type_name ?? "-"})  [${scheme}]`,
      );
    }
    // A month where added entries are mostly phone/name (instead of uid) is
    // the signature of the expired* reports carrying the member id under a
    // different key than the expiring* reports the stored snapshot was built
    // from — which would add an already-present member again under a
    // different identity.
    console.log(
      `identity schemes for added: uid=${schemeCounts.uid} phone=${schemeCounts.phone} name=${schemeCounts.name}`,
    );
  }

  if (dropped.length > 0) {
    console.log(`unmapped membership types (NOT backfilled): ${dropped.length}`);
    for (const d of dropped) {
      console.log(`  ${d.end_date}  ${d.name}  "${d.membership_type_name}"`);
    }
  }

  if (addedEntries.length === 0) {
    console.log("nothing to add");
  } else if (!APPLY) {
    console.log("dry run, no write");
  }

  return { reportMonth, rawRow, rowExisted, createdAt, stored, merged, addedEntries, dropped };
}

/**
 * PHASE 2 for one month: write the backup file, then upsert. Only called
 * after every month has passed PHASE 1's invariant checks.
 */
async function writeMonth(
  supabase: ReturnType<typeof getAdminClient>,
  plan: MonthPlan,
  backupDir: string,
  stamp: string,
): Promise<void> {
  const { reportMonth, addedEntries } = plan;

  if (addedEntries.length === 0) {
    console.log(`${reportMonth}: nothing to add, skipping write`);
    return;
  }

  // Back the row up before touching anything. If no row exists yet, the
  // backup file holds `null` — restoring that is not a rollback (it would
  // not delete the row an upsert is about to insert), so the rollback
  // instructions differ below.
  const backupPath = path.join(
    backupDir,
    `retention-backfill-${reportMonth}-${stamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(plan.rawRow ?? null, null, 2));
  console.log(`backup: ${backupPath}`);
  const rollbackInstructions = plan.rowExisted
    ? `Rollback: ${backupPath}`
    : `Rollback: DELETE FROM retention_reports WHERE report_month = '${reportMonth}'`;

  const upsertRow: Record<string, unknown> = {
    report_month: reportMonth,
    data: plan.merged as unknown as Record<string, unknown>,
  };
  // Preserve the original snapshot timestamp so the row still reads as that
  // month's snapshot rather than as something built today.
  if (plan.createdAt) upsertRow.created_at = plan.createdAt;

  const { error: upErr } = await supabase
    .from("retention_reports")
    .upsert(upsertRow, { onConflict: "report_month" });

  if (upErr) throw new Error(`upsert ${reportMonth} failed: ${upErr.message}`);

  console.log(`WROTE ${reportMonth}. ${rollbackInstructions}`);
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

  // Fetch expiredMembershipsReport + expiredSessionsReport exactly ONCE,
  // across overlapping monthly windows, and union+dedupe the result. Do NOT
  // re-fetch per target month: expiredSessionsReport does not honour
  // fromDate/toDate, so a narrow per-month query under-collects rows whose
  // end_date falls in that month but which only surface in a neighbouring
  // month's window. Each target month buckets its own rows out of this same
  // union via isEndDateInMonth inside buildBackfillFromExpired.
  const expired = await fetchAllExpiredEntries(pause);
  console.log(
    `arbox: fetched ${expired.length} unique expired rows across ${EXPIRED_FETCH_WINDOWS.length} windows`,
  );

  // PHASE 1: build + merge + validate every month from the shared expired-
  // entry union. No writes. A throw in any month aborts here, before
  // anything has been written for any month.
  const plans: MonthPlan[] = [];
  for (const month of MONTHS) {
    plans.push(await prepareMonth(supabase, month, expired));
  }

  console.log(`\n${"=".repeat(60)}\nUNMAPPED MEMBERSHIP TYPES ACROSS ALL MONTHS\n${"=".repeat(60)}`);
  const allDropped = plans.flatMap((p) => p.dropped);
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
    return;
  }

  // PHASE 2: every month passed PHASE 1, so write them all.
  console.log(`\n${"=".repeat(60)}\nWRITING\n${"=".repeat(60)}`);
  for (const plan of plans) {
    await writeMonth(supabase, plan, backupDir, stamp);
  }
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
