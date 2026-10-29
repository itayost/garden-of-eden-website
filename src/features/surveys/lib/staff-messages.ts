import { SHARED_MESSAGES } from "./messages";

/**
 * The Hebrew texts the staff actions answer with, in one place so a refusal
 * reads the same wherever it comes from. Texts the Trainee side and the rules
 * also say come from SHARED_MESSAGES.
 */
export const STAFF_MESSAGES = {
  staffOnly: "רק מנהלים ומנהלי סניפים",
  invalidId: SHARED_MESSAGES.invalidId,
  invalidInput: SHARED_MESSAGES.invalidInput,
  notFound: SHARED_MESSAGES.notFound,
  notAllowed: "אין הרשאה לסקר הזה",
  noBranch: SHARED_MESSAGES.noBranch,
  hasResponses: "כבר יש תשובות, אי אפשר לשנות שאלות או קהל",
  unpublishHasResponses: "כבר יש תשובות, אי אפשר להחזיר לטיוטה",
  deleteHasResponses: "יש תשובות לסקר, רק מנהל יכול למחוק אותו",
  alreadyPublished: "הסקר כבר פורסם",
  notPublished: "הסקר עוד לא פורסם",
  alreadyClosed: SHARED_MESSAGES.closed,
  closedNoDraft: "סקר שנסגר לא חוזר לטיוטה",
  closedNoEdit: "סקר שנסגר אי אפשר לערוך",
  closeDatePassed: SHARED_MESSAGES.closeDatePassed,
  closeBeforeOpen: SHARED_MESSAGES.closeBeforeOpen,
  changedMeanwhile: "הסקר השתנה בינתיים. נסו שוב.",
  failed: "השמירה נכשלה. נסו שוב.",
} as const;

/** What save_survey_draft raises on purpose, matched inside Postgres's longer text. */
const SAVE_ERRORS = [
  { code: "survey_has_responses", message: STAFF_MESSAGES.hasResponses },
  { code: "survey_not_found", message: STAFF_MESSAGES.notFound },
  // The surveys_dates CHECK: the action refuses this first, this is the backstop.
  { code: "surveys_dates", message: STAFF_MESSAGES.closeBeforeOpen },
] as const;

/** The Hebrew message for an error the save function raises on purpose or a CHECK it can trip, or null for any other failure. */
export function saveErrorMessage(dbMessage: string): string | null {
  const known = SAVE_ERRORS.find(({ code }) => dbMessage.includes(code));
  return known?.message ?? null;
}
