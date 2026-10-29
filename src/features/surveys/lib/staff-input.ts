import { STAFF_MESSAGES } from "./staff-messages";

/**
 * A form sends an empty close date as "", which the date schema would refuse:
 * it means no close date. Anything that is not an object passes through for
 * the schema to refuse.
 */
export function withBlankClosesOn(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const { closesOn } = input as { closesOn?: unknown };
  const isBlank = typeof closesOn === "string" && closesOn.trim() === "";
  return isBlank ? { ...input, closesOn: null } : input;
}

/**
 * Why a new close date is refused, or null. It must be no earlier than today
 * or the opening day, whichever is later. Days are Israel calendar dates in
 * YYYY-MM-DD form, so string comparison orders them.
 */
export function closeDateProblem(opensOn: string, closesOn: string | null, today: string): string | null {
  if (closesOn === null) return null;
  if (closesOn < today) return STAFF_MESSAGES.closeDatePassed;
  if (closesOn < opensOn) return STAFF_MESSAGES.closeBeforeOpen;
  return null;
}
