import { isValidDateString } from "@/lib/validations/common";
import { addDays } from "@/lib/utils/iso-date";

/** How far ahead an admin may mark a trainee active for courses. */
export const MAX_MARK_DAYS = 365;

/**
 * Why a mark's last day is refused, or null when it is fine. The day must be a
 * real date, from today to MAX_MARK_DAYS ahead, both inclusive.
 */
export function markProblem(until: string, today: string): string | null {
  if (!isValidDateString(until)) return "תאריך לא תקין";
  if (until < today) return "התאריך כבר עבר";
  if (until > addDays(today, MAX_MARK_DAYS)) return "עד שנה קדימה";
  return null;
}
