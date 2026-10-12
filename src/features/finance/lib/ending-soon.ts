/**
 * Who staff should call before a plan runs out. Pure, over each Trainee's
 * resolved Plan queue (src/lib/plans/plan-queue.ts): the queue already folds
 * renewals, freezes and bookings into one end date and one sessions count.
 * These thresholds are staff-only and wider than the parent reminders
 * (ENDING_SOON_DAYS there), on purpose: staff call before the parent's
 * WhatsApp goes out.
 */
import { daysBetween } from "@/lib/utils/iso-date";
import type { PlanStatus } from "@/types/plans";

export const STAFF_ENDING_DAYS = 7;
export const STAFF_ENDING_SESSIONS = 2;
export const RECENTLY_EXPIRED_DAYS = 14;

export interface EndingInput {
  profileId: string;
  status: PlanStatus;
  /** The last day of the whole queue. */
  endsOn: string;
  /** Unbooked sessions left on the queue's Cards; null with no Card. */
  sessionsLeft: number | null;
  cardsOnly: boolean;
  /** Future Bookings already charged to the queue. */
  booked: number;
  /** A parent reminder stamp is set on the queue's last Plan. */
  reminded: boolean;
  /** An unpaid Payment link waits for this Trainee. */
  linkWaiting: boolean;
  frozen: { endsOn: string | null } | null;
  /** The queue ends on a Plan paid in Arbox: no automatic reminder goes out. */
  paidInArbox: boolean;
}

export type EndingEntry<T extends EndingInput> = T & { by: "date" | "sessions"; daysLeft: number };
export type ExpiredEntry<T extends EndingInput> = T & { daysAgo: number };

export interface EndingSplit<T extends EndingInput> {
  ending: EndingEntry<T>[];
  expired: ExpiredEntry<T>[];
}

const RUNNING: readonly PlanStatus[] = ["active", "ending_soon"];

function endingBy(q: EndingInput, today: string): "date" | "sessions" | null {
  if (!RUNNING.includes(q.status)) return null;
  if (q.cardsOnly && q.sessionsLeft !== null && q.sessionsLeft <= STAFF_ENDING_SESSIONS) return "sessions";
  if (daysBetween(today, q.endsOn) <= STAFF_ENDING_DAYS) return "date";
  return null;
}

const bySessionsLeft = (q: EndingInput) => q.sessionsLeft ?? Number.MAX_SAFE_INTEGER;

export function splitEnding<T extends EndingInput>(inputs: readonly T[], today: string): EndingSplit<T> {
  const ending = inputs
    .flatMap((q): EndingEntry<T>[] => {
      const by = endingBy(q, today);
      return by ? [{ ...q, by, daysLeft: daysBetween(today, q.endsOn) }] : [];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || bySessionsLeft(a) - bySessionsLeft(b));

  const expired = inputs
    .flatMap((q): ExpiredEntry<T>[] => {
      if (q.status !== "expired") return [];
      const daysAgo = daysBetween(q.endsOn, today);
      return daysAgo >= 1 && daysAgo <= RECENTLY_EXPIRED_DAYS ? [{ ...q, daysAgo }] : [];
    })
    .sort((a, b) => a.daysAgo - b.daysAgo);

  return { ending, expired };
}

export function endingSoonCount(inputs: readonly EndingInput[], today: string): number {
  return splitEnding(inputs, today).ending.length;
}

export type EndingFilter = "all" | "link" | "reminded" | "arbox" | "expired";
const FILTERS: readonly EndingFilter[] = ["all", "link", "reminded", "arbox", "expired"];

export function parseEndingFilter(value: string | undefined): EndingFilter {
  return FILTERS.find((f) => f === value) ?? "all";
}

export interface EndingCounts {
  all: number;
  byDate: number;
  bySessions: number;
  link: number;
  reminded: number;
  arbox: number;
  expired: number;
}

export function endingCounts<T extends EndingInput>(split: EndingSplit<T>): EndingCounts {
  const { ending, expired } = split;
  return {
    all: ending.length,
    byDate: ending.filter((e) => e.by === "date").length,
    bySessions: ending.filter((e) => e.by === "sessions").length,
    link: ending.filter((e) => e.linkWaiting).length,
    reminded: ending.filter((e) => e.reminded).length,
    arbox: ending.filter((e) => e.paidInArbox).length,
    expired: expired.length,
  };
}

export function filterEnding<T extends EndingInput>(
  split: EndingSplit<T>,
  filter: EndingFilter,
): (EndingEntry<T> | ExpiredEntry<T>)[] {
  switch (filter) {
    case "link":
      return split.ending.filter((e) => e.linkWaiting);
    case "reminded":
      return split.ending.filter((e) => e.reminded);
    case "arbox":
      return split.ending.filter((e) => e.paidInArbox);
    case "expired":
      return split.expired;
    default:
      return split.ending;
  }
}
