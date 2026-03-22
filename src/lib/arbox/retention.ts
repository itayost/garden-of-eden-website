const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";
const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface ExpiringMembershipEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly membership_type_name: string | null;
  readonly end_date: string | null;
}

export interface RetentionEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly end_date: string;
  readonly membership_type_name: string | null;
  readonly attendance: readonly (number | null)[];
}

export interface RetentionReportData {
  readonly monthly: readonly RetentionEntry[];
  readonly pro: readonly RetentionEntry[];
  readonly training_card: readonly RetentionEntry[];
}

type CategoryKey = keyof RetentionReportData;

// -------------------------------------------------------
// Membership type mapping
// Contains "פרו" → PRO
// "כרטיסייה" → training card
// Contains "מתקדמים" → monthly
// Everything else → skipped
// -------------------------------------------------------

export function getCategoryForMembershipType(
  typeName: string | null,
): CategoryKey | null {
  if (!typeName) return null;
  if (typeName.includes("פרו")) return "pro";
  if (typeName === "כרטיסייה") return "training_card";
  if (typeName.includes("מתקדמים")) return "monthly";
  return null;
}

// -------------------------------------------------------
// Arbox API fetching
// -------------------------------------------------------

export interface BookingEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly date: string;
  readonly check_in: string; // "Yes" | "No"
}

interface ArboxReportResponse<T> {
  readonly statusCode: number;
  readonly data: readonly T[];
  readonly extra: readonly unknown[];
}

async function fetchReportPage<T>(
  reportName: string,
  fromDate: string,
  toDate: string,
  page: number,
): Promise<readonly T[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY is not set");

  const url = `${BASE_URL}/reports/${reportName}?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Arbox ${reportName} failed: ${res.status}`);
  }

  const json: ArboxReportResponse<T> = await res.json();
  return json.data ?? [];
}

async function fetchAllPages<T>(
  reportName: string,
  fromDate: string,
  toDate: string,
): Promise<readonly T[]> {
  if (!fromDate || !toDate || fromDate > toDate) {
    throw new Error(`Invalid date range for ${reportName}`);
  }

  let all: readonly T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const entries = await fetchReportPage<T>(reportName, fromDate, toDate, page);
    all = [...all, ...entries];
    if (entries.length < PAGE_LIMIT) break;
    page++;
  }

  return all;
}

export async function fetchExpiringMemberships(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  return fetchAllPages<ExpiringMembershipEntry>("expiringMembershipsReport", fromDate, toDate);
}

export async function fetchExpiringSessions(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  return fetchAllPages<ExpiringMembershipEntry>("expiringSessionsReport", fromDate, toDate);
}

async function fetchBookingsReport(
  fromDate: string,
  toDate: string,
): Promise<readonly BookingEntry[]> {
  return fetchAllPages<BookingEntry>("bookingsReport", fromDate, toDate);
}

// -------------------------------------------------------
// Processing: match attendance to expiring members
// -------------------------------------------------------

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-()]/g, "").replace(/^0/, "972");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getMonthKey(dateStr: string): string {
  // Timezone-safe: split "YYYY-MM-DD" directly
  return dateStr.slice(0, 7);
}

function calculateAttendance(
  memberUserId: number | null,
  memberPhone: string | null,
  memberName: string,
  bookings: readonly BookingEntry[],
  monthKeys: readonly string[],
): readonly (number | null)[] {
  const normalizedMemberPhone = normalizePhone(memberPhone);
  const normalizedMemberName = normalizeName(memberName);

  // Filter bookings that belong to this member AND were checked in
  const memberBookings = bookings.filter((e) => {
    if (e.check_in !== "Yes") return false;

    // Priority 1: user_id match
    if (
      memberUserId != null &&
      e.user_id != null &&
      memberUserId === e.user_id
    ) {
      return true;
    }
    // Priority 2: phone match
    if (
      normalizedMemberPhone &&
      normalizePhone(e.phone) === normalizedMemberPhone
    ) {
      return true;
    }
    // Priority 3: name match
    if (normalizeName(e.name) === normalizedMemberName) {
      return true;
    }
    return false;
  });

  return monthKeys.map((mk) => {
    const count = memberBookings.filter(
      (e) => getMonthKey(e.date) === mk,
    ).length;
    return count > 0 ? count : null;
  });
}

/**
 * Get the 3 month keys (YYYY-MM) before a given report month.
 * e.g. for "2026-03-01" returns ["2026-02", "2026-01", "2025-12"]
 */
export function getAttendanceMonthKeys(
  reportMonth: string,
): readonly string[] {
  const d = new Date(reportMonth + "T00:00:00");
  const keys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

/**
 * Get 3 individual month ranges before reportMonth (respects Arbox 31-day limit).
 * e.g. for "2026-03-01" returns:
 *   [{ from: "2026-02-01", to: "2026-02-28" },
 *    { from: "2026-01-01", to: "2026-01-31" },
 *    { from: "2025-12-01", to: "2025-12-31" }]
 */
function getAttendanceMonthRanges(
  reportMonth: string,
): readonly { from: string; to: string }[] {
  const d = new Date(reportMonth + "T00:00:00");
  const fmt = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const ranges: { from: string; to: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const firstDay = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
    ranges.push({ from: fmt(firstDay), to: fmt(lastDay) });
  }
  return ranges;
}

// -------------------------------------------------------
// Main report builder
// -------------------------------------------------------

export async function buildRetentionReport(
  reportMonth: string,
): Promise<RetentionReportData> {
  const d = new Date(reportMonth + "T00:00:00");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const toExpiring = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${lastDay}`;

  // Fetch expiring memberships + sessions for current month (parallel)
  const [expiringMemberships, expiringSessions] = await Promise.all([
    fetchExpiringMemberships(reportMonth, toExpiring),
    fetchExpiringSessions(reportMonth, toExpiring),
  ]);

  const allExpiring = [...expiringMemberships, ...expiringSessions];

  // Fetch bookings for previous 3 months (one call per month, 31-day API limit)
  const bookingChunks = await Promise.all(
    getAttendanceMonthRanges(reportMonth).map(({ from, to }) =>
      fetchBookingsReport(from, to),
    ),
  );
  const bookings = bookingChunks.flat();

  const monthKeys = getAttendanceMonthKeys(reportMonth);

  // Group by category
  const grouped: Record<CategoryKey, RetentionEntry[]> = {
    monthly: [],
    pro: [],
    training_card: [],
  };

  for (const member of allExpiring) {
    const category = getCategoryForMembershipType(member.membership_type_name);
    if (!category) {
      console.warn(
        `[Retention] Skipping unknown membership type: "${member.membership_type_name}" for ${member.name}`,
      );
      continue;
    }

    const attendance = calculateAttendance(
      member.user_id,
      member.phone,
      member.name,
      bookings,
      monthKeys,
    );

    grouped[category] = [
      ...grouped[category],
      {
        user_id: member.user_id,
        name: member.name,
        phone: member.phone,
        end_date: member.end_date ?? "",
        membership_type_name: member.membership_type_name,
        attendance,
      },
    ];
  }

  // Sort each category by end_date descending
  const sortByEndDate = (a: RetentionEntry, b: RetentionEntry) =>
    b.end_date.localeCompare(a.end_date);

  return {
    monthly: [...grouped.monthly].sort(sortByEndDate),
    pro: [...grouped.pro].sort(sortByEndDate),
    training_card: [...grouped.training_card].sort(sortByEndDate),
  };
}
