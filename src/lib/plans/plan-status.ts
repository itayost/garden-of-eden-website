import { addDays, daysBetween } from "@/lib/utils/iso-date";
import type { PlanStatus, TraineePlan } from "@/types/plans";

/** How close to the end a plan counts as "ending soon", inclusive. */
export const ENDING_SOON_DAYS = 3;

type StatusInput = Pick<TraineePlan, "status" | "ends_on" | "sessions_total">;

/**
 * The one rule for a plan's state. Every surface calls this with the same
 * roster count and the same "today" (israelToday()), so the dashboard, the
 * roster chip, and the reminder cron cannot disagree.
 */
export function resolvePlanStatus(
  plan: StatusInput,
  sessionsUsed: number,
  today: string,
): PlanStatus {
  if (plan.status === "cancelled") return "cancelled";
  if (today > plan.ends_on) return "expired";

  if (plan.sessions_total !== null) {
    const left = plan.sessions_total - sessionsUsed;
    if (left <= 0) return "expired";
    if (left === 1) return "ending_soon";
  }

  if (daysBetween(today, plan.ends_on) <= ENDING_SOON_DAYS) return "ending_soon";
  return "active";
}

type WindowInput = Pick<TraineePlan, "starts_on" | "ends_on" | "branch_id">;

/**
 * Roster presence counts as a used session: a row for this trainee on a slot
 * in the plan's branch, dated inside the plan window and not after today.
 * Future rosters are plans, not attendance.
 */
export function countSessionsUsedFromRows(
  rows: readonly {
    schedule_date: string;
    branch_id: string | null;
    /** A self-cancelled booking frees the session unless it was late. */
    cancelled_at?: string | null;
    late_cancel?: boolean;
  }[],
  plan: WindowInput,
  today: string,
): number {
  const last = today < plan.ends_on ? today : plan.ends_on;
  return rows.filter(
    (row) =>
      row.branch_id === plan.branch_id &&
      (row.cancelled_at == null || row.late_cancel === true) &&
      row.schedule_date >= plan.starts_on &&
      row.schedule_date <= last,
  ).length;
}

/** A renewal never overlaps: it starts the day after a plan still running. */
export function renewalStartDate(previousEndsOn: string | null, today: string): string {
  if (previousEndsOn === null || previousEndsOn < today) return today;
  return addDays(previousEndsOn, 1);
}

export type ReminderMilestone = "three_days" | "last_session" | "expired";

type ReminderInput = StatusInput &
  Pick<TraineePlan, "reminded_3_days_at" | "reminded_last_session_at" | "reminded_expired_at">;

/**
 * Which reminder is due today and not yet sent, or null. Later milestones win
 * so a plan that slipped past three_days unsent still gets the expired note.
 */
export function dueReminderMilestone(
  plan: ReminderInput,
  sessionsUsed: number,
  today: string,
): ReminderMilestone | null {
  const status = resolvePlanStatus(plan, sessionsUsed, today);
  if (status === "cancelled" || status === "active") return null;

  if (status === "expired") {
    return plan.reminded_expired_at ? null : "expired";
  }

  const sessionsLeft =
    plan.sessions_total === null ? null : plan.sessions_total - sessionsUsed;
  if (sessionsLeft === 1) {
    return plan.reminded_last_session_at ? null : "last_session";
  }
  return plan.reminded_3_days_at ? null : "three_days";
}
