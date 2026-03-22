import { normalizePhone } from "./normalize-phone";
import { ARBOX_BASE_URL, ARBOX_PAGE_LIMIT, ARBOX_MAX_PAGES } from "./constants";

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

interface BookingEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly date: string;
  readonly check_in: string;
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

  const url = `${ARBOX_BASE_URL}/reports/${reportName}?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&page=${page}&limit=${ARBOX_PAGE_LIMIT}`;
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

  const all: T[] = [];
  let page = 1;

  while (page <= ARBOX_MAX_PAGES) {
    const entries = await fetchReportPage<T>(reportName, fromDate, toDate, page);
    all.push(...entries);
    if (entries.length < ARBOX_PAGE_LIMIT) break;
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
// Processing: pre-index bookings for O(N+M) lookup
// -------------------------------------------------------

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface BookingIndex {
  readonly byUserId: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly byPhone: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly byName: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

function buildBookingIndex(bookings: readonly BookingEntry[]): BookingIndex {
  const byUserId = new Map<number, Map<string, number>>();
  const byPhone = new Map<string, Map<string, number>>();
  const byName = new Map<string, Map<string, number>>();

  for (const b of bookings) {
    if (b.check_in !== "Yes") continue;

    const monthKey = b.date.slice(0, 7);

    if (b.user_id != null) {
      const monthMap = byUserId.get(b.user_id) ?? new Map<string, number>();
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
      byUserId.set(b.user_id, monthMap);
    }

    const phone = normalizePhone(b.phone);
    if (phone) {
      const monthMap = byPhone.get(phone) ?? new Map<string, number>();
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
      byPhone.set(phone, monthMap);
    }

    const name = normalizeName(b.name);
    const monthMap = byName.get(name) ?? new Map<string, number>();
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
    byName.set(name, monthMap);
  }

  return { byUserId, byPhone, byName };
}

function lookupAttendance(
  memberUserId: number | null,
  memberPhone: string | null,
  memberName: string,
  index: BookingIndex,
  monthKeys: readonly string[],
): readonly (number | null)[] {
  const normalizedPhone = normalizePhone(memberPhone);
  const normalizedName = normalizeName(memberName);

  // Find the best matching month map (priority: user_id > phone > name)
  const monthMap =
    (memberUserId != null ? index.byUserId.get(memberUserId) : undefined) ??
    (normalizedPhone ? index.byPhone.get(normalizedPhone) : undefined) ??
    index.byName.get(normalizedName);

  if (!monthMap) {
    return monthKeys.map(() => null);
  }

  return monthKeys.map((mk) => {
    const count = monthMap.get(mk);
    return count != null && count > 0 ? count : null;
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

function formatDateYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Get 3 individual month ranges before reportMonth (respects Arbox 31-day limit).
 */
function getAttendanceMonthRanges(
  reportMonth: string,
): readonly { from: string; to: string }[] {
  const d = new Date(reportMonth + "T00:00:00");
  const ranges: { from: string; to: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const firstDay = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
    ranges.push({ from: formatDateYMD(firstDay), to: formatDateYMD(lastDay) });
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
  const bookingIndex = buildBookingIndex(bookings);

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

    const attendance = lookupAttendance(
      member.user_id,
      member.phone,
      member.name,
      bookingIndex,
      monthKeys,
    );

    grouped[category].push({
      user_id: member.user_id,
      name: member.name,
      phone: member.phone,
      end_date: member.end_date ?? "",
      membership_type_name: member.membership_type_name,
      attendance,
    });
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
