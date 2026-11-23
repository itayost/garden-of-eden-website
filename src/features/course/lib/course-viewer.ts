import { parseAccessOverride, resolveAccessTier } from "@/lib/access/course-access";

import type { CourseViewer } from "./course-access-rule";

/** The profile columns the course rule reads. */
export const COURSE_VIEWER_COLUMNS =
  "role, is_active, course_seen_training_on, course_access_until, arbox_bought_course, arbox_paid_training, access_override";

export interface CourseViewerRow {
  readonly role: string | null;
  readonly is_active: boolean | null;
  readonly course_seen_training_on: string | null;
  readonly course_access_until: string | null;
  readonly arbox_bought_course: boolean | null;
  readonly arbox_paid_training: boolean | null;
  readonly access_override: string | null;
}

/**
 * The viewer canOpenCourse sees, from a profile row. A buyer of the digital
 * course is someone Arbox says bought it or an admin set to course_only: the
 * course is all that tier may reach, so it must never lock for them. Course-only
 * is the middleware's own tier (`resolveAccessTier()`), so the course rule and
 * the routes agree on who may reach only the digital course. No row reads as no
 * viewer (no role), which the rule locks once it is on. Pure.
 */
export function courseViewerFromProfile(row: CourseViewerRow | null): CourseViewer {
  const accessOverride = parseAccessOverride(row?.access_override);
  return {
    role: row?.role ?? null,
    isActive: row?.is_active === true,
    seenTrainingOn: row?.course_seen_training_on ?? null,
    accessUntil: row?.course_access_until ?? null,
    boughtCourse: row?.arbox_bought_course === true || accessOverride === "course_only",
    courseOnly:
      resolveAccessTier({
        arboxPaidTraining: row?.arbox_paid_training === true,
        arboxBoughtCourse: row?.arbox_bought_course === true,
        accessOverride,
      }) === "course_only",
  };
}
