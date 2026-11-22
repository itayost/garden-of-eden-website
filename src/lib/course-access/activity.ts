import type { PlanQueueView } from "@/features/plans/lib/queries";
import { isTrainingNow } from "@/features/course/lib/course-access-rule";

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
 * Plan holders but not one queue back: loadPlanQueues logs its own read
 * errors and returns nothing, so this is how the sweep sees a failed read.
 */
export function planQueuesLookUnread(planHolders: number, queuesRead: number): boolean {
  return planHolders > 0 && queuesRead === 0;
}

/**
 * Trainees the training rule would lock once this sweep is the last good one:
 * the stamps it writes applied, and today as the sweep day. Ignores the
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
      !isTrainingNow(
        {
          role: "trainee",
          isActive: true,
          seenTrainingOn: stampedIds.has(p.id) ? today : p.seenOn,
          accessUntil: p.accessUntil,
          boughtCourse: false,
        },
        ctx,
      ),
  );
}
