import { daysBetween } from "@/lib/utils/iso-date";
import type { PlanKind, TraineePlan } from "@/types/plans";
import type { QueuePlan } from "./plan-queue";

export type QueuePlanRow = Pick<
  TraineePlan,
  | "id"
  | "branch_id"
  | "status"
  | "starts_on"
  | "ends_on"
  | "sessions_total"
  | "not_before"
  | "duration_days"
  | "fixed_ends_on"
  | "ended_on"
  | "created_at"
> & {
  product: { kind: PlanKind } | null;
  /** The Plan's Freezes, embedded as plan_freezes(id, starts_on, ends_on). */
  plan_freezes?: { id: string; starts_on: string; ends_on: string | null }[] | null;
};

/** The embed every queue read adds to its trainee_plans select. */
export const PLAN_FREEZES_EMBED = "plan_freezes(id, starts_on, ends_on)";

/**
 * A stored Plan with its sale-time terms in the queue's shape. A Plan written
 * before the terms were stored takes its stored window as its terms, which
 * gives it back exactly the dates it had.
 */
export function toQueuePlan<R extends QueuePlanRow>(row: R): R & QueuePlan {
  return {
    ...row,
    kind: row.product?.kind ?? "subscription",
    branchId: row.branch_id,
    sessionsTotal: row.sessions_total,
    durationDays: row.duration_days ?? daysBetween(row.starts_on, row.ends_on) + 1,
    notBefore: row.not_before ?? row.starts_on,
    fixedEndsOn: row.fixed_ends_on,
    endedOn: row.ended_on,
    createdAt: row.created_at,
    freezes: (row.plan_freezes ?? []).map((f) => ({ id: f.id, startsOn: f.starts_on, endsOn: f.ends_on })),
  };
}
