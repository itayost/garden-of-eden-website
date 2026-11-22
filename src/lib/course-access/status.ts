export const RULE_NOT_ON_STATUS = "הכלל עוד לא פעיל: הגישה לפי הכלל הקודם";

export interface CourseAccessStatusInput {
  /** The training rule decides (a good sweep a week old exists); false while the old rule holds. */
  readonly ruleOn: boolean;
  readonly trainingNow: boolean;
  readonly seenTrainingOn: string | null;
  readonly accessUntil: string | null;
  /** Israel day. */
  readonly today: string;
}

/**
 * The staff card's status lines for a trainee's course access. While the old
 * rule holds the card says so, and still shows a mark staff have set ahead of
 * the switch. `show` formats a bare day for people. Pure.
 */
export function courseAccessStatusLines(input: CourseAccessStatusInput, show: (day: string) => string): string[] {
  const { ruleOn, trainingNow, seenTrainingOn, accessUntil, today } = input;
  const markLine = accessUntil !== null && accessUntil >= today ? `מסומן פעיל עד ${show(accessUntil)}` : null;

  if (!ruleOn) return markLine ? [RULE_NOT_ON_STATUS, markLine] : [RULE_NOT_ON_STATUS];
  if (markLine) return [markLine];
  if (trainingNow && seenTrainingOn) return [`פעיל: נראה מתאמן ב-${show(seenTrainingOn)}`];
  return ["לא פעיל: אין מנוי, כרטיסייה או מסלול פעילים"];
}
