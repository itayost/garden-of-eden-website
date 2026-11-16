/**
 * Which Assessments the nightly job looks at, and which open proposals have
 * gone stale. Pure: the loaders read the rows and the checks.
 *
 * The wizard inserts an Assessment at its first step and updates it per step,
 * with no "finished" event, so an Assessment is due when it is the Trainee's
 * newest live one, dated in the last DUE_WINDOW_DAYS, and was last changed
 * before today's Israel day began. A failed run is retried on later nights, at
 * most MAX_ATTEMPTS times. An Assessment that had no candidates or no pick is
 * due again when staff changed it after that check; one that was proposed on
 * is never looked at again.
 */
import { addDays } from "@/lib/utils/iso-date";
import { israelDateStr } from "@/lib/utils/israel-time";

export const DUE_WINDOW_DAYS = 14;
export const MAX_ATTEMPTS = 3;
/** An open proposal older than this expires. */
export const PROPOSAL_TTL_DAYS = 30;
/** A metric whose proposal was rejected this recently is not proposed again. */
export const REJECTED_QUIET_DAYS = 60;
export const MAX_PER_RUN = 40;
/** A sensitive entry of this many days up to the run marks the proposals. */
export const SENSITIVE_LOOKBACK_DAYS = 14;

/** An Assessment as the job reads it; `changedAt` is the snapshot's `computed_at`, else `created_at`. */
export interface DueRow {
  id: string;
  traineeId: string;
  date: string;
  createdAt: string;
  changedAt: string;
}

/** A stored check; `checkedAt` is when it was last claimed. */
export interface CheckState {
  outcome: string;
  attempts: number;
  checkedAt: string;
}

/** An Assessment to claim: the attempt count the claim records, and the check as read (null for none). */
export interface DueItem {
  id: string;
  traineeId: string;
  attempts: number;
  previous: { outcome: string; checkedAt: string } | null;
}

interface Dated {
  id: string;
  traineeId: string;
  date: string;
  createdAt: string;
}

/** Oldest first: positive when `a` is newer (the later date, then the later `createdAt`, "" losing, then the id). */
function olderFirst(a: Dated, b: Dated): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function newestRows<T extends Dated>(rows: readonly T[]): Map<string, T> {
  const newest = new Map<string, T>();
  for (const row of rows) {
    const current = newest.get(row.traineeId);
    if (!current || olderFirst(row, current) > 0) newest.set(row.traineeId, row);
  }
  return newest;
}

/**
 * Trainee id to the id of their newest Assessment (the date, then `createdAt`).
 * The due rule and the expiry both read "newest" through it.
 */
export function newestByTrainee(rows: readonly Dated[]): Map<string, string> {
  return new Map([...newestRows(rows)].map(([traineeId, row]) => [traineeId, row.id]));
}

/** The claim a check allows, or null when it is not due. */
function claimOf(
  check: CheckState | undefined,
  changedAt: string,
  today: string,
): Pick<DueItem, "attempts" | "previous"> | null {
  if (!check) return { attempts: 1, previous: null };
  const previous = { outcome: check.outcome, checkedAt: check.checkedAt };
  if (check.outcome === "unfinished") {
    const retry = check.attempts < MAX_ATTEMPTS && israelDateStr(check.checkedAt) < today;
    return retry ? { attempts: check.attempts + 1, previous } : null;
  }
  if (check.outcome === "no_candidates" || check.outcome === "none_picked") {
    const changedSince = Date.parse(check.checkedAt) < Date.parse(changedAt);
    return changedSince ? { attempts: 1, previous } : null;
  }
  return null;
}

/** The Assessments to claim tonight, oldest first, at most MAX_PER_RUN. */
export function dueAssessments(
  rows: readonly DueRow[],
  checks: ReadonlyMap<string, CheckState>,
  today: string,
): DueItem[] {
  const from = addDays(today, -DUE_WINDOW_DAYS);
  const due = [...newestRows(rows).values()]
    .filter((row) => row.date >= from && row.date <= today && israelDateStr(row.changedAt) < today)
    .map((row) => ({ row, claim: claimOf(checks.get(row.id), row.changedAt, today) }))
    .filter((entry): entry is { row: DueRow; claim: NonNullable<typeof entry.claim> } => entry.claim !== null);
  return [...due]
    .sort((a, b) => olderFirst(a.row, b.row))
    .slice(0, MAX_PER_RUN)
    .map(({ row, claim }) => ({ id: row.id, traineeId: row.traineeId, ...claim }));
}

/** An open proposal as the expiry reads it. */
export interface OpenProposal {
  id: string;
  traineeId: string;
  assessmentId: string;
  metricKey: string;
  createdAt: string;
  assessmentDeleted: boolean;
}

/**
 * The open proposals to expire: older than PROPOSAL_TTL_DAYS (Israel day), on
 * a metric that got an open Goal another way (`${traineeId}:${metricKey}` in
 * `openGoals`), on a soft-deleted Assessment, or on an Assessment that is no
 * longer the Trainee's newest live one, whatever the newer one's check says.
 */
export function staleProposals(
  open: readonly OpenProposal[],
  openGoals: ReadonlySet<string>,
  newest: ReadonlyMap<string, string>,
  today: string,
): string[] {
  const oldestKept = addDays(today, -PROPOSAL_TTL_DAYS);
  return open
    .filter(
      (proposal) =>
        israelDateStr(proposal.createdAt) < oldestKept ||
        openGoals.has(`${proposal.traineeId}:${proposal.metricKey}`) ||
        proposal.assessmentDeleted ||
        newest.get(proposal.traineeId) !== proposal.assessmentId,
    )
    .map((proposal) => proposal.id);
}
