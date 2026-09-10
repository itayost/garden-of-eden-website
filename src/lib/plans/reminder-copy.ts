import type { ReminderMilestone } from "./plan-status";

export const REMINDED_COLUMN: Record<
  ReminderMilestone,
  "reminded_3_days_at" | "reminded_last_session_at" | "reminded_expired_at"
> = {
  three_days: "reminded_3_days_at",
  last_session: "reminded_last_session_at",
  expired: "reminded_expired_at",
};

/** The {{4}} parameter of the reminder template. */
export function reminderReason(milestone: ReminderMilestone): string {
  switch (milestone) {
    case "three_days":
      return "מסתיים בעוד 3 ימים";
    case "last_session":
      return "נותר אימון אחד";
    case "expired":
      return "הסתיים";
  }
}
