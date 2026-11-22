import type { PlanQueueView } from "@/features/plans/lib/queries";
import { isTrainingNow } from "@/features/course/lib/course-access-rule";
import type { TrainingNow } from "@/lib/arbox/training-now";

/** A sweep with fewer Arbox ids than this share of the last good one is treated as a failed read. */
export const MIN_SWEEP_SHARE = 0.5;

export interface ActivityProfile {
  readonly id: string;
  readonly arboxUserId: number | null;
  readonly seenOn: string | null;
}

/** A live trainee as the sweep reads him, with the admin mark that also keeps a course open. */
export interface SweptTrainee extends ActivityProfile {
  readonly accessUntil: string | null;
}

/** A Plan queue that is running, waiting, or held by a Freeze counts as training. */
export function queueIsTraining(view: PlanQueueView | undefined): boolean {
  if (!view) return false;
  const { current, queued, frozen } = view.queue;
  return current !== null || queued.length > 0 || frozen !== null;
}

/** Guards against stamping from an empty or truncated Arbox read. */
export function isBelievableSweep(arboxIds: number, lastGoodArboxIds: number | null): boolean {
  if (arboxIds <= 0) return false;
  if (lastGoodArboxIds === null) return true;
  return arboxIds >= Math.ceil(lastGoodArboxIds * MIN_SWEEP_SHARE);
}

/**
 * Why an Arbox read cannot be trusted, or null when it can. Arbox answers a
 * report with no `data` as zero rows, so an empty memberships or cards report
 * is a failed read, even on the first sweep: it would lock every member it
 * left out. The on-hold report may be empty.
 */
export function arboxReadProblem(input: {
  readonly rows: TrainingNow["rows"];
  readonly arboxIds: number;
  readonly lastGoodArboxIds: number | null;
}): string | null {
  const { rows, arboxIds, lastGoodArboxIds } = input;
  if (rows.memberships <= 0) return "memberships_report_empty";
  if (rows.cards <= 0) return "cards_report_empty";
  if (!isBelievableSweep(arboxIds, lastGoodArboxIds)) return "arbox_rows_too_few";
  return null;
}

/** Ids to stamp with today. Never moves a stamp back: a later run may have written a later day. */
export function planActivityStamps(input: {
  readonly profiles: readonly ActivityProfile[];
  readonly arboxTrainingIds: ReadonlySet<number>;
  readonly planTrainingIds: ReadonlySet<string>;
  readonly today: string;
}): string[] {
  const { profiles, arboxTrainingIds, planTrainingIds, today } = input;
  return profiles
    .filter((p) => p.seenOn === null || p.seenOn < today)
    .filter(
      (p) =>
        (p.arboxUserId !== null && arboxTrainingIds.has(p.arboxUserId)) ||
        planTrainingIds.has(p.id),
    )
    .map((p) => p.id);
}

/**
 * Trainees the training rule would lock, once it is on, with this sweep as the
 * last good one: the stamps it writes applied, and today as the sweep day. Ignores the
 * digital course buyers' exception, which keeps only that one course open.
 */
export function wouldLockAfterSweep<T extends SweptTrainee>(input: {
  readonly profiles: readonly T[];
  readonly stampedIds: ReadonlySet<string>;
  readonly today: string;
}): T[] {
  const { profiles, stampedIds, today } = input;
  const ctx = { today, lastGoodSweepOn: today };
  return profiles.filter(
    (p) =>
      !isTrainingNow({ seenTrainingOn: stampedIds.has(p.id) ? today : p.seenOn, accessUntil: p.accessUntil }, ctx),
  );
}

/**
 * Whether a Void or Cancellation should wipe a trainee's seen-training day, so
 * a sale undone within days does not leave a week of course access behind it.
 * Only for a trainee with no Arbox link and no Plan running or queued after
 * today: an Arbox-linked trainee may be training there, and clearing him would
 * lock him until the next good sweep re-stamps him.
 */
export function shouldClearSeenTraining(input: {
  readonly seenOn: string | null;
  readonly linkedToArbox: boolean;
  readonly trainingAfterToday: boolean;
}): boolean {
  return input.seenOn !== null && !input.linkedToArbox && !input.trainingAfterToday;
}
