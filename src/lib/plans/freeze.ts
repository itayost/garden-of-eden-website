import { inFreeze, type PlanFreeze, type PlanQueue, type QueuePlan } from "./plan-queue";

/** The two stretches share a day; an open-ended one runs on without an end. */
const overlaps = (a: PlanFreeze, b: PlanFreeze) =>
  a.startsOn <= (b.endsOn ?? "￿") && b.startsOn <= (a.endsOn ?? "￿");

/**
 * Why a Freeze cannot go on this Plan, or null. Only the Current plan is
 * frozen, never from before it started or after it ends, never over a day a session already
 * took place (it was used), and never over another Freeze.
 */
export function freezeProblem<P extends QueuePlan>(
  queue: PlanQueue<P>,
  planId: string,
  freeze: PlanFreeze,
): string | null {
  const entry = queue.current;
  if (!entry || entry.plan.id !== planId) return "אפשר להקפיא רק את המסלול הנוכחי";
  if (freeze.startsOn < entry.startsOn) return "ההקפאה מתחילה לפני תחילת המסלול";
  // A Freeze past the Plan's end pauses nothing and would only add days to it.
  if (freeze.startsOn > entry.expiresOn) return "ההקפאה מתחילה אחרי סיום המסלול";
  if (freeze.endsOn !== null && freeze.endsOn < freeze.startsOn) return "תאריך הסיום קודם לתאריך ההתחלה";
  if ((entry.plan.freezes ?? []).some((f) => overlaps(f, freeze))) return "ההקפאה חופפת להקפאה קיימת";
  const used = entry.charged.slice(0, entry.used);
  if (used.some((r) => inFreeze(freeze, r.schedule_date))) {
    return "בתאריכים האלה כבר התקיים אימון";
  }
  return null;
}
