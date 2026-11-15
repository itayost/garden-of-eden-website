/**
 * When the dashboard asks a Trainee for a parent phone, and which answers it
 * refuses. Pure: the dates are Israel calendar days, the caller passes them.
 */

import { daysBetween } from "@/lib/utils/iso-date";
import { normalizePhoneIL } from "@/lib/validations/common";

/** "לא עכשיו" hides the card for this many days. */
export const PARENT_PROMPT_SNOOZE_DAYS = 7;

/** From this age nobody is asked for a parent. */
export const ADULT_AGE = 18;

export interface ParentPromptProfile {
  role: string | null;
  guardianPhone: string | null;
  guardianNotNeeded: boolean;
  birthdate: string | null;
  /** The Israel date of the last "לא עכשיו", or null. */
  dismissedOn: string | null;
}

/** Whole years on `today`; both are ISO dates. A birthday on `today` counts. */
export function ageOn(birthdate: string, today: string): number {
  const [birthYear, birthMonth, birthDay] = birthdate.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

export function shouldAskParentPhone(profile: ParentPromptProfile, today: string): boolean {
  if (profile.role !== "trainee") return false;
  if (profile.guardianPhone?.trim()) return false;
  if (profile.guardianNotNeeded) return false;
  if (profile.birthdate && ageOn(profile.birthdate, today) >= ADULT_AGE) return false;
  if (profile.dismissedOn && daysBetween(profile.dismissedOn, today) < PARENT_PROMPT_SNOOZE_DAYS) return false;
  return true;
}

/** A child typing their own login phone is the mistake this guards. */
export function parentPhoneRefusal(phone: string, ownPhone: string | null): string | null {
  const parent = normalizePhoneIL(phone);
  const own = normalizePhoneIL(ownPhone);
  if (parent !== null && parent === own) return "זה המספר שלך. צריך את המספר של אחד ההורים";
  return null;
}

/** "אני מעל 18" is refused when the birthdate says otherwise. */
export function noParentRefusal(birthdate: string | null, today: string): string | null {
  if (birthdate && ageOn(birthdate, today) < ADULT_AGE) return "האפשרות הזו מיועדת רק למי שמעל גיל 18";
  return null;
}
