/**
 * Arbox purchases as the nightly import sees them.
 *
 * A purchase is keyed by Arbox's own `membership_user_id`, the one id that is
 * stable and unique per sale. Memberships carry it in their report; the cards
 * report does not, so a card is joined to its sale on (user, item, start
 * date). A card that matches no sale or several is reported, never guessed:
 * a wrong key would import the same card twice or two cards as one.
 */

export type ArboxPurchaseKind = "card" | "membership";

export interface ArboxPurchase {
  /** Arbox's id for the purchase; the import's identity. */
  readonly membershipUserId: number;
  readonly userId: number;
  readonly kind: ArboxPurchaseKind;
  readonly itemName: string;
  readonly purchaseDate: string;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Cards only: what Arbox says is left. `total_sessions` is a template. */
  readonly sessionsLeft: number | null;
  readonly paid: number | null;
  readonly status: string;
}

type Num = number | string | null | undefined;

export interface SessionsReportRow {
  readonly user_id?: Num;
  readonly membership_type_name?: string | null;
  readonly purchase_date?: string | null;
  readonly start_date?: string | null;
  readonly end_date?: string | null;
  readonly sessions_left?: Num;
  readonly paid?: Num;
  readonly status?: string | null;
}

export interface MembershipsReportRow {
  readonly user_id?: Num;
  readonly membership_type_name?: string | null;
  readonly membership_user_id?: Num;
  readonly purchase_date?: string | null;
  readonly start_date?: string | null;
  readonly end_date?: string | null;
  readonly paid?: Num;
  readonly status?: string | null;
}

export interface SalesReportRow {
  readonly user_id?: Num;
  readonly item_name?: string | null;
  readonly item_type?: string | null;
  readonly membership_user_id?: Num;
  readonly start_date?: string | null;
  readonly status?: string | null;
}

export interface UnmatchedCard {
  readonly userId: number;
  readonly itemName: string;
  readonly startDate: string | null;
  readonly matches: number;
}

function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Which purchases become plans. Camps and mistaken items never do. */
export function purchaseKindOf(name: string | null | undefined): ArboxPurchaseKind | null {
  if (!name) return null;
  if (name.includes("מחנה") || name.includes("טעות")) return null;
  if (name.includes("כרטיסי")) return "card";
  if (name.trim().startsWith("מנוי")) return "membership";
  return null;
}

const saleKey = (userId: number, itemName: string, startDate: string): string =>
  `${userId}|${itemName}|${startDate}`;

function activeSessionSalesByKey(sales: readonly SalesReportRow[]): Map<string, Set<number>> {
  const byKey = new Map<string, Set<number>>();
  for (const s of sales) {
    const userId = toNumber(s.user_id);
    const id = toNumber(s.membership_user_id);
    if (s.item_type !== "session" || s.status !== "active") continue;
    if (userId === null || id === null || !s.item_name || !s.start_date) continue;
    const key = saleKey(userId, s.item_name, s.start_date);
    byKey.set(key, new Set([...(byKey.get(key) ?? []), id]));
  }
  return byKey;
}

interface CardCandidate {
  readonly row: SessionsReportRow;
  readonly userId: number;
  readonly itemName: string;
  readonly ids: readonly number[];
}

function cardCandidates(
  cards: readonly SessionsReportRow[],
  sales: Map<string, Set<number>>,
): CardCandidate[] {
  return cards.flatMap((row) => {
    const userId = toNumber(row.user_id);
    const itemName = row.membership_type_name ?? "";
    if (userId === null || purchaseKindOf(itemName) !== "card") return [];
    const ids = row.start_date ? [...(sales.get(saleKey(userId, itemName, row.start_date)) ?? [])] : [];
    return [{ row, userId, itemName, ids }];
  });
}

function toCard(c: CardCandidate, id: number): ArboxPurchase {
  const startDate = c.row.start_date as string;
  return {
    membershipUserId: id,
    userId: c.userId,
    kind: "card",
    itemName: c.itemName,
    purchaseDate: c.row.purchase_date ?? startDate,
    startDate,
    endDate: c.row.end_date ?? null,
    sessionsLeft: toNumber(c.row.sessions_left),
    paid: toNumber(c.row.paid),
    status: c.row.status ?? "",
  };
}

function toMembership(row: MembershipsReportRow): ArboxPurchase | null {
  const userId = toNumber(row.user_id);
  const id = toNumber(row.membership_user_id);
  const itemName = row.membership_type_name ?? "";
  if (userId === null || id === null || !row.start_date) return null;
  if (purchaseKindOf(itemName) !== "membership") return null;
  return {
    membershipUserId: id,
    userId,
    kind: "membership",
    itemName,
    purchaseDate: row.purchase_date ?? row.start_date,
    startDate: row.start_date,
    endDate: row.end_date ?? null,
    sessionsLeft: null,
    paid: toNumber(row.paid),
    status: row.status ?? "",
  };
}

export function purchasesFromReports(input: {
  cards: readonly SessionsReportRow[];
  memberships: readonly MembershipsReportRow[];
  sales: readonly SalesReportRow[];
}): { purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] } {
  const candidates = cardCandidates(input.cards, activeSessionSalesByKey(input.sales));

  // One sale claimed by two card rows would give both the same key.
  const claims = candidates
    .filter((c) => c.ids.length === 1)
    .reduce((acc, c) => acc.set(c.ids[0], (acc.get(c.ids[0]) ?? 0) + 1), new Map<number, number>());
  const isUnique = (c: CardCandidate) => c.ids.length === 1 && claims.get(c.ids[0]) === 1;

  const cards = candidates.filter(isUnique).map((c) => toCard(c, c.ids[0]));
  const unmatchedCards = candidates
    .filter((c) => !isUnique(c))
    .map((c) => ({ userId: c.userId, itemName: c.itemName, startDate: c.row.start_date ?? null, matches: c.ids.length }));
  const memberships = input.memberships
    .map(toMembership)
    .filter((p): p is ArboxPurchase => p !== null);

  return { purchases: [...cards, ...memberships], unmatchedCards };
}
