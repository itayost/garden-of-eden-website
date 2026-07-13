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

export interface BookingEntry {
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
  attempt = 1,
): Promise<readonly T[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY is not set");

  const url = `${ARBOX_BASE_URL}/reports/${reportName}?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&page=${page}&limit=${ARBOX_PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const delayMs = res.status === 429
      ? 1000 * 2 ** (attempt - 1)
      : 500 * 2 ** (attempt - 1);
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchReportPage(reportName, fromDate, toDate, page, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Arbox ${reportName} failed: ${res.status}`);
  }

  const json: ArboxReportResponse<T> = await res.json();
  return json.data ?? [];
}

export async function fetchAllPages<T>(
  reportName: string,
  fromDate: string,
  toDate: string,
): Promise<readonly T[]> {
  if (!fromDate || !toDate || fromDate > toDate) {
    throw new Error(`Invalid date range for ${reportName}`);
  }

  const all: T[] = [];
  let page = 1;
  let lastPageWasFull = false;

  while (page <= ARBOX_MAX_PAGES) {
    const entries = await fetchReportPage<T>(reportName, fromDate, toDate, page);
    all.push(...entries);
    lastPageWasFull = entries.length >= ARBOX_PAGE_LIMIT;
    if (!lastPageWasFull) break;
    page++;
  }

  if (lastPageWasFull) {
    console.warn(
      `[Arbox] ${reportName} ${fromDate}..${toDate} hit ARBOX_MAX_PAGES (${ARBOX_MAX_PAGES}) with a full last page. ` +
        `Results are truncated at ${ARBOX_MAX_PAGES * ARBOX_PAGE_LIMIT} rows; some rows for this range were not fetched.`,
    );
  }

  return all;
}

// -------------------------------------------------------
// Raw Arbox rows -> typed entries.
// The Arbox reports expose the member name as `full_name` (with
// `first_name`/`last_name`), not `name`. Map defensively so a renamed or
// missing field degrades to "" / null instead of throwing and killing the
// whole report.
// -------------------------------------------------------

export type RawArboxRow = Record<string, unknown>;

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Member name from an Arbox report row: full_name, else first+last, else "". */
function arboxName(row: RawArboxRow): string {
  const full = str(row.full_name) ?? str(row.name);
  if (full) return full;
  const composed = [str(row.first_name), str(row.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed;
}

export function toExpiringEntry(row: RawArboxRow): ExpiringMembershipEntry {
  return {
    user_id: num(row.user_id),
    name: arboxName(row),
    phone: str(row.phone),
    membership_type_name: str(row.membership_type_name),
    end_date: str(row.end_date),
  };
}

function toBookingEntry(row: RawArboxRow): BookingEntry {
  return {
    user_id: num(row.user_id),
    name: arboxName(row),
    phone: str(row.phone),
    date: str(row.date) ?? "",
    check_in: str(row.check_in) ?? "",
  };
}

export async function fetchExpiringMemberships(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>("expiringMembershipsReport", fromDate, toDate);
  return rows.map(toExpiringEntry);
}

export async function fetchExpiringSessions(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>("expiringSessionsReport", fromDate, toDate);
  return rows.map(toExpiringEntry);
}

export async function fetchBookingsReport(
  fromDate: string,
  toDate: string,
): Promise<readonly BookingEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>("bookingsReport", fromDate, toDate);
  return rows.map(toBookingEntry);
}

// -------------------------------------------------------
// Processing: pre-index bookings for O(N+M) lookup
// -------------------------------------------------------

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export interface BookingIndex {
  readonly byUserId: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly byPhone: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly byName: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

export function buildBookingIndex(bookings: readonly BookingEntry[]): BookingIndex {
  const byUserId = new Map<number, Map<string, number>>();
  const byPhone = new Map<string, Map<string, number>>();
  const byName = new Map<string, Map<string, number>>();

  for (const b of bookings) {
    if (b.check_in !== "Yes") continue;
    if (!b.date) continue;

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

export function lookupAttendance(
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
 * Get 4 month keys (YYYY-MM): current month + 3 previous months.
 * Index 0 = current month (report month), 1-3 = previous months.
 * e.g. for "2026-04-01" returns ["2026-04", "2026-03", "2026-02", "2026-01"]
 */
export function getAttendanceMonthKeys(
  reportMonth: string,
): readonly string[] {
  const d = new Date(reportMonth + "T00:00:00");
  const keys: string[] = [];
  // Index 0: current month (the report month itself)
  keys.push(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  );
  // Indexes 1-3: previous 3 months
  for (let i = 1; i <= 3; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

export function formatDateYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Get 4 individual month ranges: current month + 3 previous months
 * (respects Arbox 31-day API limit per request).
 */
export function getAttendanceMonthRanges(
  reportMonth: string,
): readonly { from: string; to: string }[] {
  const d = new Date(reportMonth + "T00:00:00");
  const ranges: { from: string; to: string }[] = [];
  // Index 0: current month
  const currentFirst = new Date(d.getFullYear(), d.getMonth(), 1);
  const currentLast = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  ranges.push({ from: formatDateYMD(currentFirst), to: formatDateYMD(currentLast) });
  // Indexes 1-3: previous 3 months
  for (let i = 1; i <= 3; i++) {
    const firstDay = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
    ranges.push({ from: formatDateYMD(firstDay), to: formatDateYMD(lastDay) });
  }
  return ranges;
}

// -------------------------------------------------------
// Merge: preserve already-ended members across refreshes
//
// Arbox's expiring reports only return memberships whose end_date is still in
// the future, so a plain refresh would drop everyone who already ended this
// month. Merging the fresh pull into the stored snapshot keeps those members
// (and their notes, keyed by report_month + phone) while updating/adding the
// ones Arbox still returns.
// -------------------------------------------------------

/**
 * Stable identity for a retention entry: user_id > phone > name+end_date.
 * The name fallback includes end_date so two different id/phone-less members
 * who happen to share a name are not collapsed into one (which would silently
 * drop one of them on merge).
 */
export function entryIdentity(entry: RetentionEntry): string {
  if (entry.user_id != null) return `uid:${entry.user_id}`;
  const phone = normalizePhone(entry.phone);
  if (phone) return `phone:${phone}`;
  return `name:${normalizeName(entry.name)}|${entry.end_date}`;
}

const sortByEndDate = (a: RetentionEntry, b: RetentionEntry) =>
  b.end_date.localeCompare(a.end_date);

/** Dedup a category by identity (last wins) and sort by end_date descending. */
function dedupAndSort(
  entries: readonly RetentionEntry[],
): readonly RetentionEntry[] {
  const byId = new Map<string, RetentionEntry>();
  for (const entry of entries) {
    byId.set(entryIdentity(entry), entry);
  }
  return [...byId.values()].sort(sortByEndDate);
}

export function mergeRetentionReports(
  stored: RetentionReportData,
  fresh: RetentionReportData,
): RetentionReportData {
  // Identities present anywhere in the fresh pull. A stored entry that
  // reappears fresh (possibly in a different category) is replaced by the
  // fresh one rather than kept in both places.
  const freshIds = new Set<string>();
  for (const category of ["monthly", "pro", "training_card"] as const) {
    for (const entry of fresh[category] ?? []) {
      freshIds.add(entryIdentity(entry));
    }
  }

  const mergeCategory = (key: CategoryKey): readonly RetentionEntry[] => {
    // Defensive `?? []`: a stored row written by an older shape (or hand-edited)
    // could be missing a category key; never throw on a stale snapshot.
    const keptStored = (stored[key] ?? []).filter(
      (entry) => !freshIds.has(entryIdentity(entry)),
    );
    return dedupAndSort([...keptStored, ...(fresh[key] ?? [])]);
  };

  return {
    monthly: mergeCategory("monthly"),
    pro: mergeCategory("pro"),
    training_card: mergeCategory("training_card"),
  };
}

// -------------------------------------------------------
// Report-month filtering + entry -> RetentionReportData builder
//
// Arbox's expiringSessionsReport (and its backward-looking twin,
// expiredSessionsReport) do not honour the fromDate/toDate range they are
// given: a query for month M's window can return cards whose end_date falls
// well outside M (verified in production: a June-window query returned cards
// with end_date running into September). Every row must therefore be
// filtered by its own end_date rather than trusted to already be in range.
//
// This builder is shared by the nightly current-month build
// (buildRetentionReport, below) and the historical backfill script
// (scripts/backfill-retention-expired.ts) so both paths apply the same
// end_date filter and category routing.
// -------------------------------------------------------

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
 * Turn a set of expiring/expired-report rows into a RetentionReportData for
 * one month.
 *
 * Rows whose end_date does not fall inside reportMonth are excluded (see
 * isEndDateInMonth above) - this is what keeps out-of-range rows from
 * Arbox's session reports out of the wrong month's snapshot. A row with a
 * null end_date is excluded too: a membership with no end date cannot be
 * attributed to any month.
 *
 * Cancelled memberships arrive as ordinary rows and are kept: they were paying
 * members who left in that month, so they are retention-relevant. ending_reason
 * is deliberately not consulted.
 *
 * Rows whose membership type the category mapper does not recognise are
 * collected in `dropped` rather than silently discarded, so the true scope of
 * the unmapped-type problem becomes visible.
 */
export function buildReportFromEntries(
  reportMonth: string,
  entries: readonly ExpiringMembershipEntry[],
  bookingIndex: BookingIndex,
  monthKeys: readonly string[],
): BackfillBuildResult {
  const monthly: RetentionEntry[] = [];
  const pro: RetentionEntry[] = [];
  const trainingCard: RetentionEntry[] = [];
  const dropped: DroppedRow[] = [];

  const bucket: Record<CategoryKey, RetentionEntry[]> = {
    monthly,
    pro,
    training_card: trainingCard,
  };

  for (const member of entries) {
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

// -------------------------------------------------------
// Main report builder
// -------------------------------------------------------

export async function buildRetentionReport(
  reportMonth: string,
): Promise<RetentionReportData> {
  const d = new Date(reportMonth + "T00:00:00");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const toExpiring = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${lastDay}`;

  // Serialized to stay under Arbox's per-key concurrency/rate cap.
  const expiringMemberships = await fetchExpiringMemberships(
    reportMonth,
    toExpiring,
  );
  const expiringSessions = await fetchExpiringSessions(reportMonth, toExpiring);

  const allExpiring = [...expiringMemberships, ...expiringSessions];

  const bookings: BookingEntry[] = [];
  for (const { from, to } of getAttendanceMonthRanges(reportMonth)) {
    const chunk = await fetchBookingsReport(from, to);
    bookings.push(...chunk);
  }
  const bookingIndex = buildBookingIndex(bookings);

  const monthKeys = getAttendanceMonthKeys(reportMonth);

  // expiringSessionsReport does not honour fromDate/toDate (see the builder's
  // doc comment above), so every row is filtered by its own end_date rather
  // than trusted to already be scoped to reportMonth.
  const { data, dropped } = buildReportFromEntries(
    reportMonth,
    allExpiring,
    bookingIndex,
    monthKeys,
  );

  for (const row of dropped) {
    console.warn(
      `[Retention] Skipping unknown membership type: "${row.membership_type_name}" for ${row.name}`,
    );
  }

  // Sort each category by end_date descending
  return {
    monthly: [...data.monthly].sort(sortByEndDate),
    pro: [...data.pro].sort(sortByEndDate),
    training_card: [...data.training_card].sort(sortByEndDate),
  };
}
