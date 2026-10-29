/**
 * The Hebrew texts the staff actions answer with, in one place so a refusal
 * reads the same wherever it comes from.
 */
export const STAFF_MESSAGES = {
  staffOnly: "רק מנהלים ומנהלי סניפים",
  invalidId: "מזהה לא תקין",
  invalidInput: "קלט לא תקין",
  notFound: "הסקר לא נמצא",
  notAllowed: "אין הרשאה לסקר הזה",
  noBranch: "צריך לבחור לפחות סניף אחד",
  hasResponses: "כבר יש תשובות, אי אפשר לשנות שאלות או קהל",
  unpublishHasResponses: "כבר יש תשובות, אי אפשר להחזיר לטיוטה",
  deleteHasResponses: "יש תשובות לסקר, רק מנהל יכול למחוק אותו",
  alreadyPublished: "הסקר כבר פורסם",
  notPublished: "הסקר עוד לא פורסם",
  alreadyClosed: "הסקר כבר נסגר",
  closedNoDraft: "סקר שנסגר לא חוזר לטיוטה",
  closedNoEdit: "סקר שנסגר אי אפשר לערוך",
  closeDatePassed: "תאריך הסגירה כבר עבר",
  closeBeforeOpen: "תאריך הסגירה לפני תאריך הפתיחה",
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
