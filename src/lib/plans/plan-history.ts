import type { PlanQueue, QueuePlan } from "./plan-queue";

/** What history needs beyond the terms: the dates last stored for the Plan. */
type HistoryPlan = QueuePlan & { starts_on: string; ends_on: string };

export type PlanHistoryState = "current" | "queued" | "ended" | "never_runs" | "cancelled" | "addon";

export interface PlanHistoryRow<P extends HistoryPlan = HistoryPlan> {
  plan: P;
  state: PlanHistoryState;
  startsOn: string;
  endsOn: string;
  /** Null for a Plan sold by time, and for Plans outside the queue. */
  sessionsLeft: number | null;
}


/**
 * Every Plan a Trainee holds, for staff: the Current plan, the queued ones in
 * the order they will start, any that will never run (staff must act on
 * those), then everything else, newest first. A Plan the queue does not date
 * (cancelled, or an Add-on) shows the dates last stored for it.
 */
export function planHistory<P extends HistoryPlan>(plans: readonly P[], queue: PlanQueue<P>): PlanHistoryRow<P>[] {
  const ahead = queue.ahead.map((e) => ({
    plan: e.plan,
    state: (e === queue.current ? "current" : "queued") as PlanHistoryState,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    sessionsLeft: e.sessionsLeft,
  }));
  const aheadIds = new Set(ahead.map((r) => r.plan.id));

  const behind = queue.plans.filter((e) => !aheadIds.has(e.plan.id));
  // Queued past its own end: shown with the window it was sold for.
  const neverRuns = behind
    .filter((e) => e.startsOn > e.endsOn)
    .map((e) => ({
      plan: e.plan,
      state: "never_runs" as PlanHistoryState,
      startsOn: e.plan.notBefore,
      endsOn: e.endsOn,
      sessionsLeft: null,
    }));
  const ended = behind
    .filter((e) => e.startsOn <= e.endsOn)
    .map((e) => ({
      plan: e.plan,
      state: "ended" as PlanHistoryState,
      startsOn: e.startsOn,
      endsOn: e.endsOn,
      sessionsLeft: null,
    }));
  const queuedIds = new Set(queue.plans.map((e) => e.plan.id));
  const outside = plans
    .filter((p) => !queuedIds.has(p.id))
    .map((p) => ({
      plan: p,
      state: (p.status === "cancelled" ? "cancelled" : "addon") as PlanHistoryState,
      startsOn: p.starts_on,
      endsOn: p.ends_on,
      sessionsLeft: null,
    }));

  const past = [...ended, ...outside].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  return [...ahead, ...neverRuns, ...past];
}
