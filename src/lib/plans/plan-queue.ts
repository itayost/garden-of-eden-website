import { addDays, daysBetween } from "@/lib/utils/iso-date";
import {
  WEEKLY_CAP,
  WEEKLY_CAP_KINDS,
  rowCounts,
  weekBounds,
  type BookingBlock,
  type RosterRowLite,
} from "@/lib/schedule/booking-rules";
import type { PlanKind, PlanRowStatus, PlanStatus, TraineePlan } from "@/types/plans";
import { REMINDED_COLUMN } from "./reminder-copy";

/** A Plan's sale-time terms: everything the queue needs to date and count it. */
export interface QueuePlan {
  id: string;
  kind: PlanKind;
  status: PlanRowStatus;
  branchId: string;
  /** Sessions on a Card, copied at sale; null for a Plan sold by time. */
  sessionsTotal: number | null;
  /** Days the Plan runs once it starts, copied at sale. */
  durationDays: number;
  /** The earliest day the Plan may start. */
  notBefore: string;
  /** An Arbox purchase keeps the end date Arbox gave it. */
  fixedEndsOn: string | null;
  /** Sale order is queue order. */
  createdAt: string;
  /**
   * The day a Cancellation (or Early end) ended the Plan. It stays in the
   * queue up to that day, keeping the sessions it used. A cancelled Plan
   * without one is an older, hidden cancellation and stays out of the queue.
   */
  endedOn?: string | null;
}

export interface QueueRow extends RosterRowLite {
  id: string;
}

export interface PlanInQueue<P extends QueuePlan = QueuePlan> {
  plan: P;
  startsOn: string;
  /** The last day the Plan runs: its expiry, or a Card's last session if sooner. */
  endsOn: string;
  /** The last day the Plan could run: what is left on a Card expires after it. */
  expiresOn: string;
  /** Roster rows charged to the Plan, oldest first. */
  charged: readonly QueueRow[];
  /** Charged rows dated today or earlier. */
  used: number;
  /** Charged rows dated after today: Bookings still ahead. */
  booked: number;
  /** Null for a Plan sold by time. */
  sessionsLeft: number | null;
}

export interface PlanQueue<P extends QueuePlan = QueuePlan> {
  /** Every live training Plan, in queue order. */
  plans: readonly PlanInQueue<P>[];
  current: PlanInQueue<P> | null;
  /** Paid Plans waiting behind the Current plan, in the order they will start. */
  queued: readonly PlanInQueue<P>[];
  /** The Current plan, if any, then the queued ones: everything not yet over. */
  ahead: readonly PlanInQueue<P>[];
  /** Something is ahead and every Plan in it is a Card. */
  cardsOnly: boolean;
  /** The sessions on every Card in the queue, minus used, minus future Bookings. */
  sessionsLeft: number | null;
  /** The last day of the last Plan in the queue; of the last ended one when nothing is ahead. */
  endsOn: string | null;
  /** The queue's state, keyed to its end: a queued renewal keeps it active. */
  status: PlanStatus | null;
  /** The one Plan to name on a screen: current, else next, else the last that ended, else a cancelled one. */
  shown: PlanInQueue<P> | null;
}

/** How close to the end of the queue counts as "ending soon", inclusive. */
export const ENDING_SOON_DAYS = 3;

/** Roster rows in the order the queue charges them. */
export const byDateAndTime = (a: QueueRow, b: QueueRow) =>
  `${a.schedule_date} ${a.start_time}`.localeCompare(`${b.schedule_date} ${b.start_time}`);

const isTraining = (plan: QueuePlan) => plan.kind !== "addon";

/** A voided Plan was never sold: nothing in the queue sees it. */
const sold = <P extends QueuePlan>(plans: readonly P[]): P[] => plans.filter((p) => p.status !== "voided");

/**
 * Charges each counted row, in date order, to the Plan it falls in. A Card
 * takes rows until its sessions are spent and ends on the day of the last
 * one; the next Plan starts that same day. A Plan sold by time ends on its
 * date and the next starts the day after.
 */
function walkQueue<P extends QueuePlan>(
  plans: readonly P[],
  rows: readonly QueueRow[],
  today: string,
): PlanInQueue<P>[] {
  const pending = rows.filter(rowCounts).sort(byDateAndTime);
  const taken = new Set<string>();
  const result: PlanInQueue<P>[] = [];
  let earliestNext: string | null = null;

  for (const plan of plans) {
    const startsOn: string =
      earliestNext !== null && earliestNext > plan.notBefore ? earliestNext : plan.notBefore;
    const ownEnd: string = plan.fixedEndsOn ?? addDays(startsOn, plan.durationDays - 1);
    const expiresOn: string = plan.endedOn && plan.endedOn < ownEnd ? plan.endedOn : ownEnd;
    const charged: QueueRow[] = [];
    for (const row of pending) {
      if (plan.sessionsTotal !== null && charged.length >= plan.sessionsTotal) break;
      if (taken.has(row.id) || row.branch_id !== plan.branchId) continue;
      if (row.schedule_date < startsOn || row.schedule_date > expiresOn) continue;
      charged.push(row);
      taken.add(row.id);
    }

    const spent = plan.sessionsTotal !== null && charged.length >= plan.sessionsTotal;
    const endsOn: string = spent ? charged[charged.length - 1].schedule_date : expiresOn;
    const used = charged.filter((r) => r.schedule_date <= today).length;
    result.push({
      plan,
      startsOn,
      endsOn,
      expiresOn,
      charged,
      used,
      booked: charged.length - used,
      sessionsLeft: plan.sessionsTotal === null ? null : plan.sessionsTotal - charged.length,
    });
    // The queue only moves forward: a Plan that never ran (an Arbox Plan
    // queued past its own end) holds the next one to its own start.
    const next = spent ? endsOn : addDays(endsOn, 1);
    earliestNext = next > startsOn ? next : startsOn;
  }
  return result;
}

/** A Card whose sessions have all taken place is over, even on the day of the last one. */
const usedUp = (entry: PlanInQueue) =>
  entry.plan.sessionsTotal !== null && entry.used >= entry.plan.sessionsTotal;

/**
 * The one answer to "what is this Trainee on" (ADR-0008). Every training Plan
 * waits behind the one ahead of it, in sale order. Add-ons stay outside.
 */
export function resolvePlanQueue<P extends QueuePlan>(
  allPlans: readonly P[],
  rows: readonly QueueRow[],
  today: string,
): PlanQueue<P> {
  const plans = sold(allPlans);
  // A Plan ended by a Cancellation keeps its place up to its last day.
  const inQueue = (p: P) => p.status === "active" || (p.status === "cancelled" && Boolean(p.endedOn));
  const live = plans
    .filter((p) => isTraining(p) && inQueue(p))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const entries = walkQueue(live, rows, today);

  // On the day a Card runs out by sessions the Plan behind it has started too;
  // the later one is current.
  const current =
    [...entries].reverse().find((e) => e.startsOn <= today && today <= e.endsOn && !usedUp(e)) ?? null;
  // A Plan whose window closed before the queue reached it never runs.
  const runs = (e: PlanInQueue<P>) => e.startsOn <= e.endsOn;
  const queued = (current ? entries.slice(entries.indexOf(current) + 1) : entries.filter((e) => e.startsOn > today))
    .filter(runs);
  const ahead = current ? [current, ...queued] : queued;
  const cards = ahead.filter((e) => e.sessionsLeft !== null);
  const cardsOnly = ahead.length > 0 && cards.length === ahead.length;
  const sessionsLeft = cards.length === 0 ? null : cards.reduce((sum, e) => sum + e.sessionsLeft!, 0);
  const endsOn = ahead.length > 0 ? ahead[ahead.length - 1].endsOn : (entries.at(-1)?.endsOn ?? null);

  // A queue that ends on a Cancellation reads as cancelled: no renewal nudges.
  const last = ahead.at(-1) ?? entries.at(-1);
  let status: PlanStatus | null;
  if (last?.plan.status === "cancelled") {
    status = "cancelled";
  } else if (ahead.length > 0) {
    const endingSoon =
      daysBetween(today, endsOn!) <= ENDING_SOON_DAYS || (cardsOnly && sessionsLeft! <= 1);
    status = endingSoon ? "ending_soon" : "active";
  } else if (entries.length > 0) {
    status = "expired";
  } else {
    status = plans.some((p) => isTraining(p) && p.status === "cancelled") ? "cancelled" : null;
  }

  const lastCancelled = plans
    .filter((p) => isTraining(p) && p.status === "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const shown =
    current ?? queued[0] ?? entries.at(-1) ?? (lastCancelled ? walkQueue([lastCancelled], [], today)[0] : null);

  return { plans: entries, current, queued, ahead, cardsOnly, sessionsLeft, endsOn, status, shown };
}

/** The sale-time terms of a Plan about to be sold. */
export type NewPlanTerms = Pick<
  QueuePlan,
  "kind" | "branchId" | "sessionsTotal" | "durationDays" | "notBefore" | "fixedEndsOn"
>;

/**
 * Where a Plan sold now lands: at the end of the queue, behind every Plan
 * already paid for. An Add-on stays outside and runs from its own day. The
 * dates are a forecast to store with the sale; the queue stays the authority.
 */
export function placeNewPlan<P extends QueuePlan>(
  plans: readonly P[],
  rows: readonly QueueRow[],
  terms: NewPlanTerms,
  today: string,
): { startsOn: string; endsOn: string } {
  const sold: QueuePlan = { ...terms, id: "new", status: "active", createdAt: "\uffff" };
  if (!isTraining(sold)) {
    return { startsOn: sold.notBefore, endsOn: sold.fixedEndsOn ?? addDays(sold.notBefore, sold.durationDays - 1) };
  }
  const placed = resolvePlanQueue([...plans, sold], rows, today).plans.at(-1)!;
  return { startsOn: placed.startsOn, endsOn: placed.expiresOn };
}

const CANDIDATE = "candidate";

export type BookingVerdict = { ok: true; planId: string } | { ok: false; block: BookingBlock };

/**
 * The plan side of "may this Trainee take this Slot". The Booking is tried on
 * the queue as if made: it must land on a Plan without pushing a Booking
 * already made off the queue, and a Plan sold per week keeps its cap.
 * Capacity and timing are checked elsewhere.
 */
export function bookingVerdict<P extends QueuePlan>(
  plans: readonly P[],
  rows: readonly QueueRow[],
  slot: { date: string; start_time: string; branch_id: string },
  today: string,
): BookingVerdict {
  const training = sold(plans).filter(isTraining);
  if (training.length === 0) return { ok: false, block: "no_plan" };
  if (training.every((p) => p.status === "cancelled")) return { ok: false, block: "plan_cancelled" };
  if (!training.some((p) => p.status !== "cancelled" && p.branchId === slot.branch_id)) {
    return { ok: false, block: "wrong_branch" };
  }

  const candidate: QueueRow = {
    id: CANDIDATE,
    schedule_date: slot.date,
    start_time: slot.start_time,
    branch_id: slot.branch_id,
    cancelled_at: null,
    late_cancel: false,
  };
  const chargedCount = (queue: PlanQueue<P>) => queue.plans.reduce((sum, e) => sum + e.charged.length, 0);
  const before = resolvePlanQueue(plans, rows, today);
  const after = resolvePlanQueue(plans, [...rows, candidate], today);

  const owner = after.plans.find((e) => e.charged.some((r) => r.id === CANDIDATE));
  if (!owner) {
    const covered = after.plans.some((e) => e.startsOn <= slot.date && slot.date <= e.expiresOn);
    return { ok: false, block: covered ? "no_sessions_left" : "plan_not_running" };
  }
  if (chargedCount(after) <= chargedCount(before)) return { ok: false, block: "no_sessions_left" };

  // The cap counts the week's sessions on every Plan sold per week, so one
  // Subscription handing over to the next mid-week does not reset it; a
  // Card's sessions ahead of it in the same week do not count.
  if (WEEKLY_CAP_KINDS.includes(owner.plan.kind)) {
    const { start, end } = weekBounds(slot.date);
    const inWeek = after.plans
      .filter((e) => WEEKLY_CAP_KINDS.includes(e.plan.kind))
      .flatMap((e) => e.charged)
      .filter((r) => r.id !== CANDIDATE && r.schedule_date >= start && r.schedule_date <= end).length;
    if (inWeek >= WEEKLY_CAP) return { ok: false, block: "weekly_cap" };
  }
  return { ok: true, planId: owner.plan.id };
}

/**
 * A reason that blocks every date at once, for the schedule page; null when
 * the answer depends on the date (bookingVerdict says which).
 */
export function queueBookingBlock<P extends QueuePlan>(
  plans: readonly P[],
  queue: PlanQueue<P>,
): BookingBlock | null {
  const training = sold(plans).filter(isTraining);
  if (training.length === 0) return "no_plan";
  if (training.every((p) => p.status === "cancelled")) return "plan_cancelled";
  return queue.cardsOnly && queue.sessionsLeft === 0 ? "no_sessions_left" : null;
}

export type ReminderMilestone = "three_days" | "last_session" | "expired";

type ReminderStamps = Pick<
  TraineePlan,
  "reminded_3_days_at" | "reminded_last_session_at" | "reminded_expired_at"
> & {
  /** The Plan's order was paid in Arbox: it renews there, not through our link. */
  paidInArbox: boolean;
};

/**
 * The renewal reminder due for a queue, if any, and the Plan whose stamp
 * records it: always the one at the end of the queue, so a queued renewal
 * silences the reminders and brings its own fresh stamps.
 */
export function dueReminder<P extends QueuePlan & ReminderStamps>(
  queue: PlanQueue<P>,
): { milestone: ReminderMilestone; plan: P } | null {
  // The last Plan that runs: one queued past its own end never does.
  const tail = queue.plans.filter((e) => e.startsOn <= e.endsOn).at(-1);
  if (!tail) return null;
  // A queue that ends on a Plan paid in Arbox renews in Arbox: our link would
  // contradict it, even the day after it ran out.
  if (tail.plan.paidInArbox) return null;

  let milestone: ReminderMilestone;
  if (queue.status === "expired") {
    milestone = "expired";
  } else if (queue.status === "ending_soon") {
    // Ending by sessions (one left, or every one left already booked) is the
    // last-session note; only an end by date is "three days".
    milestone = queue.cardsOnly && queue.sessionsLeft! <= 1 ? "last_session" : "three_days";
  } else {
    return null;
  }
  return tail.plan[REMINDED_COLUMN[milestone]] ? null : { milestone, plan: tail.plan };
}

export type PlanStart =
  | { kind: "today" }
  | { kind: "on"; date: string }
  /** A Card ahead can run out sooner; this is the latest it starts. */
  | { kind: "after_card"; latest: string };

/** When a Plan starts, in the words a parent needs; null when it is not in the queue. */
export function planStart<P extends QueuePlan>(queue: PlanQueue<P>, planId: string, today: string): PlanStart | null {
  const index = queue.plans.findIndex((e) => e.plan.id === planId);
  if (index === -1) return null;
  const entry = queue.plans[index];
  if (entry.startsOn <= today) return { kind: "today" };
  // A Card still ahead decides the start, even when its sessions are all
  // booked: a cancelled Booking hands it more time.
  const cardMayMoveIt = queue.ahead.some(
    (e) => e.sessionsLeft !== null && queue.plans.indexOf(e) < index,
  );
  return cardMayMoveIt ? { kind: "after_card", latest: entry.startsOn } : { kind: "on", date: entry.startsOn };
}

/** The last day of the queue when a paid Plan is waiting in it; null when none is. */
export function alreadyRenewedUntil<P extends QueuePlan>(queue: PlanQueue<P>): string | null {
  return queue.queued.length > 0 ? queue.endsOn : null;
}
