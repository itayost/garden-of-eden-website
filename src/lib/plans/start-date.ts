import { addDays } from "@/lib/utils/iso-date";
import type { PlanKind } from "@/types/plans";

/** Staff may hold a new Plan back this many days, never more. */
export const MAX_START_AHEAD_DAYS = 30;

/** The last day staff may choose for a Plan to start. */
export function latestStartDate(today: string): string {
  return addDays(today, MAX_START_AHEAD_DAYS);
}

/**
 * Why a staff-chosen start date is refused, or null. Backdating is never
 * allowed; a later start is only for a Trainee with nothing current or
 * queued, because otherwise the Plan queue decides (ADR-0008).
 */
export function startDateProblem(startsOn: string | null, today: string, queueHasPlans: boolean): string | null {
  if (startsOn === null) return null;
  if (startsOn < today) return "אי אפשר להתחיל מסלול בתאריך שעבר";
  if (startsOn > latestStartDate(today)) return `אפשר לקבוע התחלה עד ${MAX_START_AHEAD_DAYS} ימים קדימה`;
  if (queueHasPlans && startsOn !== today) {
    return "למתאמן יש מסלול פעיל או ממתין, והמסלול החדש יתחיל אחריו. אי אפשר לבחור תאריך התחלה.";
  }
  return null;
}

/**
 * The "not before" a staff sale is stored with. A chosen day holds a training
 * Plan back only while nothing is current or queued; otherwise the queue
 * decides and the Plan may start today. An Add-on sits outside the queue and
 * keeps the chosen day.
 */
export function appliedStart(
  chosen: string | null,
  today: string,
  queueHasPlans: boolean,
  kind: PlanKind,
): string {
  if (chosen === null) return today;
  if (kind !== "addon" && queueHasPlans) return today;
  return chosen;
}
