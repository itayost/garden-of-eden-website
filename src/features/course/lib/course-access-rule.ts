import { addDays } from "@/lib/utils/iso-date";

import { DIGITAL_COURSE_SLUG } from "./course-slugs";

/**
 * Who may open a course. Staff always may. A trainee opens a course while he
 * trains now: Arbox or the calendar saw him within the grace period of the last
 * good sweep, or an admin marked him until a day that has not passed. Buyers of
 * the digital course keep that course only. Pure, so the pages and the
 * video-URL action cannot disagree.
 */

/** Days back from the last good sweep that still count as training now. */
export const COURSE_ACTIVE_GRACE_DAYS = 7;

export const COURSE_ACCESS_DENIED = "הקורס פתוח למתאמנים פעילים";

export interface CourseViewer {
  readonly role: string | null;
  /** profiles.is_active, used only before the first good sweep. */
  readonly isActive: boolean;
  readonly seenTrainingOn: string | null;
  readonly accessUntil: string | null;
  /** profiles.arbox_bought_course */
  readonly boughtCourse: boolean;
}

export interface CourseAccessContext {
  readonly today: string;
  readonly lastGoodSweepOn: string | null;
}

export function isTrainingNow(viewer: CourseViewer, ctx: CourseAccessContext): boolean {
  if (viewer.accessUntil !== null && viewer.accessUntil >= ctx.today) return true;
  if (viewer.seenTrainingOn === null || ctx.lastGoodSweepOn === null) return false;
  return viewer.seenTrainingOn >= addDays(ctx.lastGoodSweepOn, -COURSE_ACTIVE_GRACE_DAYS);
}

export function canOpenCourse(
  course: { readonly slug: string; readonly activeOnly: boolean },
  viewer: CourseViewer,
  ctx: CourseAccessContext,
): boolean {
  if (viewer.role === "admin" || viewer.role === "trainer") return true;
  // Before the first good sweep nothing says who trains, so keep the old rule.
  if (ctx.lastGoodSweepOn === null) {
    return !course.activeOnly || (viewer.role === "trainee" && viewer.isActive);
  }
  if (viewer.role !== "trainee") return false;
  if (isTrainingNow(viewer, ctx)) return true;
  return course.slug === DIGITAL_COURSE_SLUG && viewer.boughtCourse;
}
