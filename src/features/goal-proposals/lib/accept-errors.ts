/**
 * What `accept_goal_proposal` answers when it refuses, in Hebrew. Pure.
 *
 * The function raises its own codes on purpose (`proposal_changed`,
 * `proposal_not_found`, `not_a_trainee`, `assessment_deleted`), which reach
 * the action inside Postgres's longer text, and the unique open-Goal index
 * refuses a second open Goal on the metric with 23505.
 */

export const ACCEPT_FAILED = "קבלת ההצעה נכשלה, נסו שוב";

const RAISED = [
  { code: "proposal_changed", message: "ההצעה השתנתה, רעננו את הדף" },
  { code: "proposal_not_found", message: "ההצעה לא נמצאה" },
  { code: "not_a_trainee", message: "ניתן להגדיר יעדים רק לחניכים" },
  { code: "assessment_deleted", message: "המבדק של ההצעה נמחק" },
] as const;

/** The Hebrew message for a failed acceptance; the calm failure for anything the function does not name. */
export function acceptErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "כבר קיים יעד פעיל למדד זה";
  const known = RAISED.find(({ code }) => error.message.includes(code));
  return known?.message ?? ACCEPT_FAILED;
}
