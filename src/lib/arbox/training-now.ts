import {
  fetchProductTypes,
  isTrainingMembership,
  toUserId,
  type MembershipRow,
  type ProductTypes,
} from "./access";
import { fetchArboxReport } from "./fetch";
import { LIVE_ARBOX_STATUSES, type SessionsReportRow } from "./purchase-rows";

/**
 * Who trains now by Arbox, for the nightly course-access sweep.
 *
 * Three reports, each a different way of training now:
 *   - activeMemberships: a running plan or session membership (classified as
 *     the access step does, so an unknown product counts, never locks);
 *   - sessions: a live card, whatever its sessions left;
 *   - membersOnHold: a frozen membership, like a frozen app Plan.
 *
 * Any failed report throws (fetchArboxReport already refuses a truncated one),
 * so the caller can treat the whole read as failed and write nothing.
 */

/** The on-hold report's name, unconfirmed against the live API: the dry run prints its row count. */
const ON_HOLD_REPORT = "membersOnHoldReport";

interface PerReport {
  memberships: number;
  cards: number;
  onHold: number;
}

export interface TrainingNow {
  ids: Set<number>;
  /** Raw report sizes; the sweep's checks (`arboxReadProblem`) read these. */
  rows: PerReport;
  /** Rows with a usable user id, training type or not: the dry run shows whether a report links to anyone. */
  rowsWithId: PerReport;
}

export interface OnHoldRow {
  readonly user_id?: string | number | null;
}

/**
 * A card still running: a live status and an end day not yet passed, whatever
 * its sessions left. The cards report also lists ended and cancelled cards. A
 * row missing either field is kept, so a thin Arbox answer never locks anyone.
 */
function isLiveCard(row: SessionsReportRow, today: string): boolean {
  if (row.status && !LIVE_ARBOX_STATUSES.has(row.status)) return false;
  return !row.end_date || row.end_date.slice(0, 10) >= today;
}

/** The Arbox user ids that train now, from the three reports' rows. Pure. */
export function trainingNowFromRows(input: {
  readonly memberships: readonly MembershipRow[];
  readonly cards: readonly SessionsReportRow[];
  readonly onHold: readonly OnHoldRow[];
  readonly products: ProductTypes;
  /** Israel day: a card whose end day is earlier no longer counts. */
  readonly today: string;
}): TrainingNow {
  const { memberships, cards, onHold, products, today } = input;
  const withId = (rows: readonly { readonly user_id?: string | number | null }[]): number =>
    rows.filter((row) => toUserId(row.user_id) !== null).length;
  const userIds = [
    ...memberships.filter((row) => isTrainingMembership(row, products)).map((row) => toUserId(row.user_id)),
    ...cards.filter((row) => isLiveCard(row, today)).map((row) => toUserId(row.user_id)),
    ...onHold.map((row) => toUserId(row.user_id)),
  ];
  return {
    ids: new Set(userIds.filter((id): id is number => id !== null)),
    rows: { memberships: memberships.length, cards: cards.length, onHold: onHold.length },
    rowsWithId: { memberships: withId(memberships), cards: withId(cards), onHold: withId(onHold) },
  };
}

export async function fetchTrainingNowUserIds(today: string): Promise<TrainingNow> {
  const products = await fetchProductTypes();
  // Serial on purpose, like the access step: Arbox rate-limits bursts.
  const memberships = await fetchArboxReport<MembershipRow>("activeMembershipsReport");
  const cards = await fetchArboxReport<SessionsReportRow>("sessionsReport");
  const onHold = await fetchArboxReport<OnHoldRow>(ON_HOLD_REPORT);
  return trainingNowFromRows({ memberships, cards, onHold, products, today });
}
