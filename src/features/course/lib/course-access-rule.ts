import { addDays } from "@/lib/utils/iso-date";

import { DIGITAL_COURSE_SLUG } from "./course-slugs";

/** Days back from the last good sweep that still count as training now. */
export const COURSE_ACTIVE_GRACE_DAYS = 7;

export const COURSE_ACCESS_DENIED = "הקורס פתוח למתאמנים פעילים";

export interface CourseViewer {
  readonly role: string | null;
  /** profiles.is_active, used only while the old rule holds. */
  readonly isActive: boolean;
  readonly seenTrainingOn: string | null;
  readonly accessUntil: string | null;
  /** profiles.arbox_bought_course, or an access_override of course_only. */
  readonly boughtCourse: boolean;
}

export interface CourseAccessContext {
  readonly today: string;
  /** The newest good sweep once the rule is on; null while the old rule holds. */
  readonly lastGoodSweepOn: string | null;
}

/** The oldest and newest good sweep days, or null when they could not be read. */
export interface SweepSpan {
  readonly oldest: string | null;
  readonly newest: string | null;
}

/**
 * The last good sweep the rule counts from, or null to keep the old rule. The
 * rule switches on only once the oldest good sweep is COURSE_ACTIVE_GRACE_DAYS
 * old: the first sweep after the deploy locks nobody that night, staff get a
 * week to mark the trainees the sweep cannot see, and nobody loses the grace
 * period the stamps have not had time to build. A failed read keeps the old
 * rule too.
 */
export function effectiveLastGoodSweep(sweeps: SweepSpan | null, today: string): string | null {
  if (sweeps === null || sweeps.oldest === null || sweeps.newest === null) return null;
  if (sweeps.oldest > addDays(today, -COURSE_ACTIVE_GRACE_DAYS)) return null;
  return sweeps.newest;
}

export function isTrainingNow(viewer: CourseViewer, ctx: CourseAccessContext): boolean {
  if (viewer.accessUntil !== null && viewer.accessUntil >= ctx.today) return true;
  if (viewer.seenTrainingOn === null || ctx.lastGoodSweepOn === null) return false;
  return viewer.seenTrainingOn >= addDays(ctx.lastGoodSweepOn, -COURSE_ACTIVE_GRACE_DAYS);
}

/**
 * Who may open a course. Staff always may. A trainee opens a course while he
 * trains now: Arbox or the calendar saw him within the grace period of the last
 * good sweep, or an admin marked him until a day that has not passed. Buyers of
 * the digital course keep that course only. Pure, so the pages and the
 * video-URL action cannot disagree.
 */
export function canOpenCourse(
  course: { readonly slug: string; readonly activeOnly: boolean },
  viewer: CourseViewer,
  ctx: CourseAccessContext,
): boolean {
  if (viewer.role === "admin" || viewer.role === "trainer") return true;
  // Until the rule is on (no good sweep a week old yet) keep the old rule.
  if (ctx.lastGoodSweepOn === null) {
    return !course.activeOnly || (viewer.role === "trainee" && viewer.isActive);
  }
  if (viewer.role !== "trainee") return false;
  if (isTrainingNow(viewer, ctx)) return true;
  return course.slug === DIGITAL_COURSE_SLUG && viewer.boughtCourse;
}
