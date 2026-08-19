import { arboxGet, fetchArboxReport } from "./fetch";

/**
 * Reading purchase history out of Arbox to decide who is a course-only buyer.
 *
 * Arbox sells the digital course as an `item`, memberships as `plan` and session
 * packs as `session`. "Ever paid for training" means a plan or session, however
 * long ago and whether or not it is still running.
 *
 * The reports do not make this easy:
 *   - activeMemberships / canceledMemberships take no dates
 *   - expiredMemberships and sales require a range, capped at 31 days
 *   - sales history only goes back to early 2026, so it cannot answer
 *     "did this person ever hold a membership" on its own
 *
 * So membership history comes from the membership reports, and course purchases
 * from sales -- which is sound because the course did not exist before 2026.
 */

/** The Arbox product name for the digital course. */
export const DIGITAL_COURSE_ITEM_NAME = "קורס דיגיטלי";

/** Arbox membership types that mean "this person paid to train here". */
const PAID_TRAINING_TYPES = new Set(["plan", "session"]);

/**
 * How far back to sweep expired memberships. Earlier than the academy's first
 * Arbox membership, so the sweep is exhaustive; each month costs one request on
 * a nightly job.
 */
const MEMBERSHIP_HISTORY_START = "2023-01-01";

/**
 * How far back to sweep sales. Arbox returns nothing before this, and the course
 * product was created in 2026, so nothing earlier can be a course purchase.
 */
const SALES_HISTORY_START = "2026-01-01";

interface MembershipTypeEntry {
  /** The product's display name. Arbox calls it this here and in the reports. */
  membership_type_name?: string | null;
  type?: string | null;
}

interface MembershipRow {
  user_id?: string | number | null;
  membership_type_name?: string | null;
  membership_type_type?: string | null;
}

interface SaleRow {
  user_id?: string | number | null;
  item_name?: string | null;
  item_type?: string | null;
}

/** Inclusive month windows from `start` to today, each within Arbox's 31-day cap. */
export function monthWindows(
  start: string,
  today: Date
): readonly { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  cursor.setUTCDate(1);
  const pad = (n: number) => String(n).padStart(2, "0");

  while (cursor <= today) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    // Never ask for a range ending in the future: Arbox may reject it, and one
    // validation error would take down the whole nightly sweep.
    const end = monthEnd > today ? today : monthEnd;
    windows.push({
      from: `${year}-${pad(month + 1)}-01`,
      to: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
    });
    cursor.setUTCMonth(month + 1);
  }
  return windows;
}

function toUserId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

interface ProductTypes {
  /** Names whose product is a plan or a session. */
  readonly paid: ReadonlySet<string>;
  /** Every product name Arbox knows, whatever its type. */
  readonly known: ReadonlySet<string>;
}

/**
 * Product name -> type, from /membershipTypes.
 *
 * Needed because the active- and expired-membership reports carry only a name,
 * while the cancelled one carries the type directly. A name reused across types
 * counts as paid training if any of its types is a plan or a session.
 */
async function fetchProductTypes(): Promise<ProductTypes> {
  const json = await arboxGet<{ data?: MembershipTypeEntry[] }>("/membershipTypes");
  const paid = new Set<string>();
  const known = new Set<string>();
  for (const entry of json.data ?? []) {
    const name = entry.membership_type_name;
    if (!name) continue;
    known.add(name);
    if (entry.type && PAID_TRAINING_TYPES.has(entry.type)) paid.add(name);
  }
  return { paid, known };
}

/**
 * Every Arbox user who has ever held a plan or session membership -- active,
 * cancelled, or expired.
 */
export async function fetchPaidTrainingUserIds(
  today: Date = new Date()
): Promise<Set<number>> {
  const products = await fetchProductTypes();
  const ids = new Set<number>();

  const consider = (rows: readonly MembershipRow[]) => {
    for (const row of rows) {
      const id = toUserId(row.user_id);
      if (!id) continue;

      // Prefer the row's own type when it has one -- that is exact, and it is
      // what excludes trials and one-off items.
      if (row.membership_type_type) {
        if (PAID_TRAINING_TYPES.has(row.membership_type_type)) ids.add(id);
        continue;
      }

      // Otherwise fall back to the name map. A name the catalogue does not know
      // (a renamed or deleted product -- the box has at least one) is counted as
      // paid training on purpose: wrongly locking a paying member out of the app
      // is far worse than wrongly granting one full access.
      const name = row.membership_type_name;
      if (!name) continue;
      if (products.paid.has(name) || !products.known.has(name)) ids.add(id);
    }
  };

  consider(await fetchArboxReport<MembershipRow>("activeMembershipsReport"));
  consider(await fetchArboxReport<MembershipRow>("canceledMembershipsReport"));

  for (const { from, to } of monthWindows(MEMBERSHIP_HISTORY_START, today)) {
    consider(
      await fetchArboxReport<MembershipRow>("expiredMembershipsReport", {
        fromDate: from,
        toDate: to,
      })
    );
  }

  return ids;
}

/** Every Arbox user who has bought the digital course. */
export async function fetchCourseBuyerIds(
  today: Date = new Date()
): Promise<Set<number>> {
  const ids = new Set<number>();

  for (const { from, to } of monthWindows(SALES_HISTORY_START, today)) {
    const sales = await fetchArboxReport<SaleRow>("salesReport", {
      fromDate: from,
      toDate: to,
    });
    for (const sale of sales) {
      const id = toUserId(sale.user_id);
      if (id && sale.item_name === DIGITAL_COURSE_ITEM_NAME) ids.add(id);
    }
  }

  return ids;
}
