import { chunk, ID_CHUNK } from "@/lib/supabase/in-chunks";
import type { QueuePlan } from "./plan-queue";

/**
 * The earliest day a roster row can be charged to any of these Plans, or
 * null when none of them can take a row.
 *
 * The queue walk (`resolvePlanQueue`) starts every Plan on its `notBefore`
 * or later, and never charges a row dated before the Plan's start. Voided
 * Plans and Add-ons never enter the walk. So a row dated before the
 * earliest `notBefore` of the other Plans can never be charged, and leaving
 * it out of the read gives the same queue.
 */
export function earliestChargeableDay(plans: readonly QueuePlan[]): string | null {
  return plans
    .filter((plan) => plan.status !== "voided" && plan.kind !== "addon")
    .reduce<string | null>((min, plan) => (min === null || plan.notBefore < min ? plan.notBefore : min), null);
}

/** One roster request: these Trainees, rows dated `from` or later. */
export interface RosterReadSlice {
  ids: string[];
  from: string;
}

/**
 * Splits the Trainees into roster requests of at most `size` ids, each
 * bounded by the earliest chargeable day of its Trainees. Trainees are
 * sorted by that day first, so each slice's bound sits close to every
 * Trainee's own. A Trainee whose Plans can take no row is left out.
 */
export function rosterReadSlices(
  plansByTrainee: ReadonlyMap<string, readonly QueuePlan[]>,
  size: number = ID_CHUNK,
): RosterReadSlice[] {
  const bounded = [...plansByTrainee]
    .map(([id, plans]) => ({ id, from: earliestChargeableDay(plans) }))
    .filter((entry): entry is { id: string; from: string } => entry.from !== null)
    .sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));
  return chunk(bounded, size).map((slice) => ({ ids: slice.map((e) => e.id), from: slice[0].from }));
}
