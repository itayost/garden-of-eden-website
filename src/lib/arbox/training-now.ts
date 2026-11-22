import {
  fetchProductTypes,
  isTrainingMembership,
  toUserId,
  type MembershipRow,
  type ProductTypes,
} from "./access";
import { fetchArboxReport } from "./fetch";
import type { SessionsReportRow } from "./purchase-rows";

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

export interface TrainingNow {
  ids: Set<number>;
  rows: { memberships: number; cards: number; onHold: number };
}

export interface OnHoldRow {
  readonly user_id?: string | number | null;
}

/** The Arbox user ids that train now, from the three reports' rows. Pure. */
export function trainingNowFromRows(input: {
  readonly memberships: readonly MembershipRow[];
  readonly cards: readonly SessionsReportRow[];
  readonly onHold: readonly OnHoldRow[];
  readonly products: ProductTypes;
}): TrainingNow {
  const { memberships, cards, onHold, products } = input;
  const userIds = [
    ...memberships.filter((row) => isTrainingMembership(row, products)).map((row) => toUserId(row.user_id)),
    ...cards.map((row) => toUserId(row.user_id)),
    ...onHold.map((row) => toUserId(row.user_id)),
  ];
  return {
    ids: new Set(userIds.filter((id): id is number => id !== null)),
    rows: { memberships: memberships.length, cards: cards.length, onHold: onHold.length },
  };
}

export async function fetchTrainingNowUserIds(): Promise<TrainingNow> {
  const products = await fetchProductTypes();
  // Serial on purpose, like the access step: Arbox rate-limits bursts.
  const memberships = await fetchArboxReport<MembershipRow>("activeMembershipsReport");
  const cards = await fetchArboxReport<SessionsReportRow>("sessionsReport");
  const onHold = await fetchArboxReport<OnHoldRow>(ON_HOLD_REPORT);
  return trainingNowFromRows({ memberships, cards, onHold, products });
}
