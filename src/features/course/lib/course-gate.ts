import "server-only";

import { canOpenCourse } from "./course-access-rule";
import { getCourseAccessContext } from "./course-access-context";
import { getCourseViewer } from "./actions/course-read";

/**
 * Whether the signed-in viewer may open this course: the rule with the viewer
 * and the last good sweep, both memoized per request. The one gate the video
 * URL action and the progress writes call, so they cannot drift apart.
 */
export async function mayOpenCourse(course: { readonly slug: string; readonly active_only: boolean | null }): Promise<boolean> {
  const [viewer, ctx] = await Promise.all([getCourseViewer(), getCourseAccessContext()]);
  return canOpenCourse({ slug: course.slug, activeOnly: course.active_only === true }, viewer, ctx);
}
