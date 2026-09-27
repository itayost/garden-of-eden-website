/**
 * Who may open a course. Staff always may. A course marked active_only (הקורס
 * הטקטי) is otherwise open only to a trainee whose account is active; Arbox
 * status plays no part. Pure, so the pages and the video-URL action cannot
 * disagree.
 */
export interface CourseViewer {
  readonly role: string | null;
  readonly isActive: boolean;
}

export const COURSE_ACCESS_DENIED = "הגישה לקורס זה פתוחה למתאמנים פעילים";

export function canOpenCourse(activeOnly: boolean, viewer: CourseViewer): boolean {
  if (viewer.role === "admin" || viewer.role === "trainer") return true;
  if (!activeOnly) return true;
  return viewer.role === "trainee" && viewer.isActive;
}
