import {
  fetchAllPages,
  getCategoryForMembershipType,
  lookupAttendance,
  toExpiringEntry,
  type BookingIndex,
  type ExpiringMembershipEntry,
  type RawArboxRow,
  type RetentionEntry,
  type RetentionReportData,
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
// (buildBackfillFromExpired already does that bucketing via
// isEndDateInMonth). Re-querying per target month would reproduce the bug.
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
 * buildBackfillFromExpired) — do not re-query per target month, that
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

// -------------------------------------------------------
// Pure builder
// -------------------------------------------------------

/**
 * expiredSessionsReport does not honour the requested range: a 2026-06-01..17
 * query returns rows with end_date running into August. Filter here rather than
 * trusting the API.
 */
export function isEndDateInMonth(
  endDate: string | null,
  reportMonth: string,
): boolean {
  if (!endDate) return false;
  return endDate.slice(0, 7) === reportMonth.slice(0, 7);
}

export interface DroppedRow {
  readonly name: string;
  readonly membership_type_name: string | null;
  readonly end_date: string;
}

export interface BackfillBuildResult {
  readonly data: RetentionReportData;
  readonly dropped: readonly DroppedRow[];
}

/**
 * Turn expired-report rows into a RetentionReportData for one month.
 *
 * Cancelled memberships arrive as ordinary rows and are kept: they were paying
 * members who left in that month, so they are retention-relevant. ending_reason
 * is deliberately not consulted.
 *
 * Rows whose membership type the category mapper does not recognise are
 * collected in `dropped` rather than silently discarded, so the true scope of
 * the unmapped-type problem becomes visible.
 */
export function buildBackfillFromExpired(
  reportMonth: string,
  expired: readonly ExpiringMembershipEntry[],
  bookingIndex: BookingIndex,
  monthKeys: readonly string[],
): BackfillBuildResult {
  const monthly: RetentionEntry[] = [];
  const pro: RetentionEntry[] = [];
  const trainingCard: RetentionEntry[] = [];
  const dropped: DroppedRow[] = [];

  const bucket: Record<keyof RetentionReportData, RetentionEntry[]> = {
    monthly,
    pro,
    training_card: trainingCard,
  };

  for (const member of expired) {
    if (!isEndDateInMonth(member.end_date, reportMonth)) continue;

    const category = getCategoryForMembershipType(member.membership_type_name);
    if (!category) {
      dropped.push({
        name: member.name,
        membership_type_name: member.membership_type_name,
        end_date: member.end_date ?? "",
      });
      continue;
    }

    bucket[category].push({
      user_id: member.user_id,
      name: member.name,
      phone: member.phone,
      end_date: member.end_date ?? "",
      membership_type_name: member.membership_type_name,
      attendance: lookupAttendance(
        member.user_id,
        member.phone,
        member.name,
        bookingIndex,
        monthKeys,
      ),
    });
  }

  return {
    data: { monthly, pro, training_card: trainingCard },
    dropped,
  };
}
