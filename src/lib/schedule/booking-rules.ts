import { addDays, daysBetween } from "@/lib/utils/iso-date";
import type { PlanKind } from "@/types/plans";

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
  /** The academy called the Slot off: its Roster stays, nobody on it uses a session. */
  called_off?: boolean;
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
export function rowCounts(row: Pick<RosterRowLite, "cancelled_at" | "late_cancel" | "called_off">): boolean {
  if (row.called_off) return false;
  return row.cancelled_at === null || row.late_cancel;
}

/** The ids of the rows that use a session: the set the booking and adjust functions compare. */
export function countedRowIds(rows: readonly (Pick<RosterRowLite, "cancelled_at" | "late_cancel" | "called_off"> & { id: string })[]): string[] {
  return rows.filter(rowCounts).map((r) => r.id);
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

export type BookingBlock =
  | "no_plan"
  | "plan_cancelled"
  | "plan_not_running"
  | "plan_frozen"
  | "no_sessions_left"
  | "weekly_cap"
  | "full"
  | "closed"
  | "outside_window"
  | "wrong_branch"
  | "already_booked"
  | "not_found"
  | "staff_only";

export const BOOKING_BLOCK_LABELS_HE: Record<BookingBlock, string> = {
  no_plan: "כדי להירשם לאימונים צריך מסלול פעיל",
  plan_cancelled: "המסלול בוטל. דברו איתנו כדי לחדש",
  plan_not_running: "המסלול לא בתוקף בתאריך הזה",
  plan_frozen: "המסלול מוקפא בתאריך הזה",
  no_sessions_left: "נוצלו כל האימונים בכרטיסייה",
  weekly_cap: `הגעת ל-${WEEKLY_CAP} אימונים השבוע`,
  full: "האימון מלא",
  closed: "ההרשמה נסגרת שעה לפני האימון",
  outside_window: `אפשר להירשם עד ${BOOKING_WINDOW_DAYS} ימים קדימה`,
  wrong_branch: "האימון בסניף אחר",
  already_booked: "כבר נרשמת לאימון הזה",
  not_found: "האימון לא נמצא",
  staff_only: "האימון הזה נרשם דרך הצוות בלבד",
};
