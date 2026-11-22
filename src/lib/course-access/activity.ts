import type { PlanQueueView } from "@/features/plans/lib/queries";

/** A sweep with fewer Arbox ids than this share of the last good one is treated as a failed read. */
export const MIN_SWEEP_SHARE = 0.5;

export interface ActivityProfile {
  readonly id: string;
  readonly arboxUserId: number | null;
  readonly seenOn: string | null;
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
