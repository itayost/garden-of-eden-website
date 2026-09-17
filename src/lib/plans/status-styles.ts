import type { PlanStatus, StaffPlanBadge } from "@/types/plans";

/**
 * One visual language for plan state. Solid fills come from the status tokens
 * in globals.css, so "active", "ending soon" and "expired" look the same on the
 * trainee's plan, the users list, the calendar roster and session building.
 */
export const PLAN_STATUS_BADGE_CLASS: Record<PlanStatus, string> = {
  active: "bg-success text-success-foreground hover:bg-success",
  ending_soon: "bg-warning text-warning-foreground hover:bg-warning",
  expired: "bg-destructive text-white hover:bg-destructive",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
};

/** Short staff chips shown next to a trainee name; only states that need attention. */
export const STAFF_PLAN_CHIP: Partial<Record<StaffPlanBadge["status"], { label: string; className: string }>> = {
  expired: { label: "פג", className: PLAN_STATUS_BADGE_CLASS.expired },
  ending_soon: { label: "מסתיים", className: PLAN_STATUS_BADGE_CLASS.ending_soon },
};
