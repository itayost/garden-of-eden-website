/**
 * Hebrew texts that more than one place in the Surveys feature says, kept
 * once so a refusal reads the same wherever it comes from: the staff actions,
 * the Trainee actions, the publish rules, the answer rules and the schemas.
 * A text only one place uses stays in that place.
 */
export const SHARED_MESSAGES = {
  invalidId: "מזהה לא תקין",
  invalidInput: "קלט לא תקין",
  notFound: "הסקר לא נמצא",
  /** Also the Trainee actions' refusal for a Survey that is not open today. */
  closed: "הסקר כבר נסגר",
  notForYou: "הסקר לא מיועד לך",
  noBranch: "צריך לבחור לפחות סניף אחד",
  closeBeforeOpen: "תאריך הסגירה לפני תאריך הפתיחה",
  closeDatePassed: "תאריך הסגירה כבר עבר",
} as const;
