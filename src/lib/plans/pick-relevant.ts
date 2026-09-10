import type { PlanKind, TraineePlan } from "@/types/plans";

export type RelevantPlanInput = Pick<TraineePlan, "status" | "starts_on" | "ends_on"> & {
  product: { kind: PlanKind } | null;
};

/**
 * The one plan to show for a trainee: the training plan running today, else
 * the soonest scheduled one, else the one that ended last. Add-ons (mental,
 * nutrition) are never "the plan": they must not hide the subscription or be
 * charged with roster sessions. Cancelled plans only show when nothing else
 * exists.
 */
export function pickRelevantPlan<T extends RelevantPlanInput>(
  plans: readonly T[],
  today: string,
): T | null {
  const training = plans.filter((p) => p.product?.kind !== "addon");
  const live = training.filter((p) => p.status !== "cancelled");
  const pool = live.length > 0 ? live : training;

  const running = pool.filter((p) => p.starts_on <= today && today <= p.ends_on);
  if (running.length > 0) {
    // Two overlapping windows only happen by manual grant; the newer wins.
    return [...running].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
  }
  const future = pool.filter((p) => p.starts_on > today);
  if (future.length > 0) {
    return [...future].sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
  }
  return [...pool].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0] ?? null;
}

/** Is this plan's window running on `today` and not cancelled? */
export function isPlanRunning(plan: RelevantPlanInput, today: string): boolean {
  return plan.status !== "cancelled" && plan.starts_on <= today && today <= plan.ends_on;
}
