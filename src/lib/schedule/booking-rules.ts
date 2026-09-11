import { addDays, daysBetween } from "@/lib/utils/iso-date";
import type { PlanKind, TraineePlan } from "@/types/plans";

/** How far ahead a trainee may book, inclusive of today. */
export const BOOKING_WINDOW_DAYS = 14;
/** Cancelling closer than this to the start counts as a used session. */
export const CANCEL_CUTOFF_HOURS = 3;
/** New bookings close this long before the start. */
export const CLOSE_BEFORE_MINUTES = 60;
/** Plans sold "per week" allow this many trainings Sunday to Saturday. */
export const WEEKLY_CAP = 2;
export const WEEKLY_CAP_KINDS: readonly PlanKind[] = ["subscription", "term"];

/** The part of a roster row the rules need. */
export interface RosterRowLite {
  schedule_date: string;
  /** HH:MM or HH:MM:SS. */
  start_time: string;
  branch_id: string | null;
  cancelled_at: string | null;
  late_cancel: boolean;
}

/** "Now" in Israel: the calendar date and minutes since midnight. */
export interface IsraelNow {
  date: string;
  minutes: number;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** Sunday to Saturday around a date, ISO strings. */
export function weekBounds(date: string): { start: string; end: string } {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -weekday);
  return { start, end: addDays(start, 6) };
}

export function isWithinBookingWindow(date: string, today: string): boolean {
  return date >= today && date <= addDays(today, BOOKING_WINDOW_DAYS);
}

/** Minutes from now until the slot starts; negative once it has started. */
export function minutesUntilSlot(date: string, time: string, now: IsraelNow): number {
  return daysBetween(now.date, date) * 24 * 60 + timeToMinutes(time) - now.minutes;
}

export function bookingClosed(date: string, time: string, now: IsraelNow): boolean {
  return minutesUntilSlot(date, time, now) <= CLOSE_BEFORE_MINUTES;
}

export type CancelState = "open" | "late" | "closed";

/** open: free cancel; late: counts as used; closed: the slot already started. */
export function cancelState(date: string, time: string, now: IsraelNow): CancelState {
  const minutes = minutesUntilSlot(date, time, now);
  if (minutes <= 0) return "closed";
  if (minutes <= CANCEL_CUTOFF_HOURS * 60) return "late";
  return "open";
}

/** A row that occupies a seat or already cost a session. */
export function rowCounts(row: Pick<RosterRowLite, "cancelled_at" | "late_cancel">): boolean {
  return row.cancelled_at === null || row.late_cancel;
}

/** Trainings in the slot's week that count against a weekly cap (staff-added too). */
export function weeklyBookingCount(
  rows: readonly RosterRowLite[],
  date: string,
  branchId: string,
): number {
  const { start, end } = weekBounds(date);
  return rows.filter(
    (r) => r.branch_id === branchId && rowCounts(r) && r.schedule_date >= start && r.schedule_date <= end,
  ).length;
}

/** Future seats the trainee holds inside the plan window: promised sessions. */
export function countReservedFromRows(
  rows: readonly RosterRowLite[],
  plan: Pick<TraineePlan, "starts_on" | "ends_on" | "branch_id">,
  today: string,
): number {
  return rows.filter(
    (r) =>
      r.branch_id === plan.branch_id &&
      r.cancelled_at === null &&
      r.schedule_date > today &&
      r.schedule_date >= plan.starts_on &&
      r.schedule_date <= plan.ends_on,
  ).length;
}

export type BookingBlock =
  | "no_plan"
  | "plan_cancelled"
  | "plan_not_running"
  | "addon"
  | "no_sessions_left"
  | "weekly_cap"
  | "full"
  | "closed"
  | "outside_window"
  | "wrong_branch"
  | "already_booked";

export const BOOKING_BLOCK_LABELS_HE: Record<BookingBlock, string> = {
  no_plan: "כדי להירשם לאימונים צריך מסלול פעיל",
  plan_cancelled: "המסלול בוטל. דברו איתנו כדי לחדש",
  plan_not_running: "המסלול לא בתוקף בתאריך הזה",
  addon: "מפגש ליווי לא נרשם דרך לוח האימונים",
  no_sessions_left: "נוצלו כל האימונים בכרטיסייה",
  weekly_cap: `הגעת ל-${WEEKLY_CAP} אימונים השבוע`,
  full: "האימון מלא",
  closed: "ההרשמה לאימון נסגרה",
  outside_window: `אפשר להירשם עד ${BOOKING_WINDOW_DAYS} ימים קדימה`,
  wrong_branch: "האימון בסניף אחר",
  already_booked: "כבר נרשמת לאימון הזה",
};

export interface EligibilityInput {
  plan: Pick<TraineePlan, "status" | "starts_on" | "ends_on" | "sessions_total"> | null;
  productKind: PlanKind | null;
  /** Sessions used so far, per countSessionsUsedFromRows. */
  used: number;
  /** Future seats held, per countReservedFromRows. */
  reserved: number;
  /** Trainings already in the slot's week, per weeklyBookingCount. */
  weekCount: number;
  slotDate: string;
}

/** The plan side of "may this trainee take this slot". Capacity and timing are checked elsewhere. */
export function bookingEligibility(input: EligibilityInput): { ok: true } | { ok: false; block: BookingBlock } {
  const { plan, productKind } = input;
  if (!plan || !productKind) return { ok: false, block: "no_plan" };
  if (plan.status === "cancelled") return { ok: false, block: "plan_cancelled" };
  if (productKind === "addon") return { ok: false, block: "addon" };
  if (input.slotDate < plan.starts_on || input.slotDate > plan.ends_on) {
    return { ok: false, block: "plan_not_running" };
  }
  if (plan.sessions_total !== null && plan.sessions_total - input.used - input.reserved < 1) {
    return { ok: false, block: "no_sessions_left" };
  }
  if (WEEKLY_CAP_KINDS.includes(productKind) && input.weekCount >= WEEKLY_CAP) {
    return { ok: false, block: "weekly_cap" };
  }
  return { ok: true };
}
