import {
  fetchAllPages,
  toExpiringEntry,
  type ExpiringMembershipEntry,
  type RawArboxRow,
} from "./retention";

// buildReportFromEntries and its supporting types now live in retention.ts
// (it is shared by buildRetentionReport, the nightly current-month build).
// Re-exported here so existing importers of this module keep working.
export {
  isEndDateInMonth,
  buildReportFromEntries,
  type DroppedRow,
  type BackfillBuildResult,
} from "./retention";

// -------------------------------------------------------
// Arbox's expired* reports are the backward-looking twins of the expiring*
// reports. The expiring* ones only return memberships whose end_date is still
// in the future, which is why past months cannot be rebuilt from them.
// -------------------------------------------------------

export async function fetchExpiredMemberships(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>(
    "expiredMembershipsReport",
    fromDate,
    toDate,
  );
  return rows.map(toExpiringEntry);
}

export async function fetchExpiredSessions(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>(
    "expiredSessionsReport",
    fromDate,
    toDate,
  );
  return rows.map(toExpiringEntry);
}

// -------------------------------------------------------
// expiredSessionsReport does not honour fromDate/toDate: querying month M's
// window does not return every row whose end_date falls in M — some rows
// only surface when a NEIGHBOURING month's window is queried. Filtering
// cannot recover a row the API never returned for a narrow per-month query.
//
// The fix is to fetch every report exactly once across a series of
// overlapping monthly windows spanning the whole backfill range, union and
// deduplicate the rows, and only then bucket by end_date per target month
// (buildReportFromEntries already does that bucketing via isEndDateInMonth).
// Re-querying per target month would reproduce the bug.
// -------------------------------------------------------

/** Calendar months to fetch expired* reports across (Arbox rejects ranges
 * longer than ~31 days, so this must stay one window per month). */
export const EXPIRED_FETCH_WINDOWS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
] as const;

/** First and last calendar day of a "YYYY-MM" window, leap-year-safe. */
export function windowRange(ym: string): { from: string; to: string } {
  const [yearStr, monthStr] = ym.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${yearStr}-${monthStr}-01`,
    to: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Stable dedup key for a row returned by an expired* report: the same row
 * comes back from multiple overlapping windows and must be counted once.
 *
 * Deliberately NOT entryIdentity (which is user_id-first): entryIdentity
 * would wrongly collapse two DIFFERENT cards belonging to the same person
 * into one row. This key must distinguish them, so it keys on the full
 * (user_id, end_date, membership_type_name) tuple instead.
 */
export function expiredRowKey(e: ExpiringMembershipEntry): string {
  return JSON.stringify([e.user_id, e.end_date, e.membership_type_name]);
}

/**
 * Fetch expiredMembershipsReport + expiredSessionsReport exactly once each,
 * across every window in EXPIRED_FETCH_WINDOWS, and return the deduplicated
 * union. Callers bucket the result per target month themselves (e.g. via
 * buildReportFromEntries) — do not re-query per target month, that
 * reproduces the under-collection bug this function exists to fix.
 *
 * `pause` is awaited after EVERY API call; Arbox rate-limits per key.
 */
export async function fetchAllExpiredEntries(
  pause: () => Promise<void>,
): Promise<readonly ExpiringMembershipEntry[]> {
  const byKey = new Map<string, ExpiringMembershipEntry>();

  for (const ym of EXPIRED_FETCH_WINDOWS) {
    const { from, to } = windowRange(ym);

    const memberships = await fetchExpiredMemberships(from, to);
    await pause();
    const sessions = await fetchExpiredSessions(from, to);
    await pause();

    for (const entry of [...memberships, ...sessions]) {
      byKey.set(expiredRowKey(entry), entry);
    }
  }

  return [...byKey.values()];
}
