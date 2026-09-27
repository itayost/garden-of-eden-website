/** The course pages ask for their course by slug, never "the first one". */
export const DIGITAL_COURSE_SLUG = "eden-player-development";
export const TACTICAL_COURSE_SLUG = "tactical";

/**
 * The course badges (first lesson, chapter complete, course complete) are the
 * digital course's: course_complete reads "צפית בכל השיעורים בקורס הדיגיטלי".
 * Other courses earn none until they have badges of their own.
 */
export function courseEarnsBadges(courseSlug: string): boolean {
  return courseSlug === DIGITAL_COURSE_SLUG;
}
