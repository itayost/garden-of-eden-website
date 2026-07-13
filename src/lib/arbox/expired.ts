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
