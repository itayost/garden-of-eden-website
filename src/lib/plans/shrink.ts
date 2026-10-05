import { byDateAndTime, resolvePlanQueue, type QueuePlan, type QueueRow } from "./plan-queue";

export interface ShrinkImpact {
  /** Bookings another Plan in the queue now pays for. */
  moved: { row: QueueRow; fromPlanId: string; toPlanId: string }[];
  /** Bookings no Plan can pay for, latest first: they are cancelled, not late. */
  cancelled: QueueRow[];
}

const chargedBy = (plans: readonly QueuePlan[], rows: readonly QueueRow[], today: string) =>
  new Map(
    resolvePlanQueue(plans, rows, today).plans.flatMap((e) => e.charged.map((r) => [r.id, e.plan.id] as const)),
  );

/**
 * The shrink rule: what happens to future Bookings and staff-added Roster
 * entries when a change takes Plans or sessions out of the queue. The queue
 * is resolved before and after; a row another Plan now pays for moves to it,
 * and a row no Plan pays for is cancelled. Every row is charged, past ones
 * included, since they use up a Card; only future seats are reported. Because
 * the queue charges in date order, what is left over is always the latest, so
 * the nearest sessions stay.
 */
export function shrinkImpact(
  before: readonly QueuePlan[],
  after: readonly QueuePlan[],
  rows: readonly QueueRow[],
  today: string,
): ShrinkImpact {
  const ahead = rows.filter((r) => r.cancelled_at === null && r.schedule_date > today);
  const paidBefore = chargedBy(before, rows, today);
  const paidAfter = chargedBy(after, rows, today);

  const moved = ahead
    .filter((r) => paidBefore.has(r.id) && paidAfter.has(r.id) && paidBefore.get(r.id) !== paidAfter.get(r.id))
    .sort(byDateAndTime)
    .map((row) => ({ row, fromPlanId: paidBefore.get(row.id)!, toPlanId: paidAfter.get(row.id)! }));
  const cancelled = ahead
    .filter((r) => paidBefore.has(r.id) && !paidAfter.has(r.id))
    .sort((a, b) => byDateAndTime(b, a));
  return { moved, cancelled };
}

/**
 * Why a Plan cannot be Voided, or null. A Void undoes a mistake as if the
 * Plan was never sold, so it is only for a Plan nobody has trained on; once a
 * session is used, ending it is a Cancellation.
 */
export function voidRefusal(
  plans: readonly QueuePlan[],
  rows: readonly QueueRow[],
  planId: string,
  today: string,
): string | null {
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return "המסלול לא נמצא";
  if (plan.status === "voided") return "הרישום של המסלול כבר בוטל";
  if (plan.status === "cancelled" && plan.endedOn) return "העסקה של המסלול כבר בוטלה";
  // A cancelled Plan sits outside the queue; count what it used as if it ran.
  const asRan = plans.map((p) => (p.id === planId && p.status === "cancelled" ? { ...p, status: "active" as const } : p));
  const used = resolvePlanQueue(asRan, rows, today).plans.find((e) => e.plan.id === planId)?.used ?? 0;
  return used > 0 ? "כבר נוצל אימון במסלול, ולכן אי אפשר לבטל את הרישום. צריך ביטול עסקה." : null;
}
