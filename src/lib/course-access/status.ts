import { addDays } from "@/lib/utils/iso-date";
import { COURSE_ACTIVE_GRACE_DAYS, isTrainingNow, type SweepSpan } from "@/features/course/lib/course-access-rule";

export const RULE_NOT_ON_STATUS = "הכלל עוד לא פעיל: הגישה לפי הכלל הקודם";

export interface CourseAccessStatusInput {
  /** The last good sweep the rule counts from; null while the old rule holds. */
  readonly lastGoodSweepOn: string | null;
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
  const { lastGoodSweepOn, seenTrainingOn, accessUntil, today } = input;
  const ruleOn = lastGoodSweepOn !== null;
  const trainingNow = isTrainingNow({ seenTrainingOn, accessUntil }, { today, lastGoodSweepOn });
  const markLine = accessUntil !== null && accessUntil >= today ? `מסומן פעיל עד ${show(accessUntil)}` : null;

  if (!ruleOn) return markLine ? [RULE_NOT_ON_STATUS, markLine] : [RULE_NOT_ON_STATUS];
  if (markLine) return [markLine];
  if (trainingNow && seenTrainingOn) return [`פעיל: נראה מתאמן ב-${show(seenTrainingOn)}`];
  return ["לא פעיל: אין מנוי, כרטיסייה או מסלול פעילים"];
}

/** A last good sweep older than this many days is worth an admin's attention. */
export const STALE_SWEEP_DAYS = 3;

export type CourseSweepNotice =
  | { readonly kind: "unread" }
  | { readonly kind: "never" }
  | { readonly kind: "pending"; readonly ruleOnFrom: string }
  | { readonly kind: "stale"; readonly lastGood: string }
  | { readonly kind: "ok" };

/**
 * What the admins' course page says about the nightly course-access sweep: a
 * failed read of the log, no good sweep yet, the day the rule switches on, or
 * a last good sweep more than STALE_SWEEP_DAYS old (everyone seen before it
 * then stays open, so someone should look). A stale sweep outranks the switch
 * day. Pure.
 */
export function courseSweepNotice(span: SweepSpan | null, today: string): CourseSweepNotice {
  if (span === null) return { kind: "unread" };
  if (span.oldest === null || span.newest === null) return { kind: "never" };
  if (span.newest < addDays(today, -STALE_SWEEP_DAYS)) return { kind: "stale", lastGood: span.newest };
  const ruleOnFrom = addDays(span.oldest, COURSE_ACTIVE_GRACE_DAYS);
  if (ruleOnFrom > today) return { kind: "pending", ruleOnFrom };
  return { kind: "ok" };
}
