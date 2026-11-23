import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCourseViewer,
  getMyLessonProgress,
  getPublishedCourse,
} from "./actions/course-read";
import { canOpenCourse } from "./course-access-rule";
import { getCourseAccessContext } from "./course-access-context";
import { courseCardFor, type CourseCard } from "./course-card";

/** Published course slugs in the order admins set (ties by id, as moveCourse). */
async function readPublishedSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("slug")
    .eq("is_published", true)
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.error("loadCourseList slugs failed:", error);
    return [];
  }
  return (data ?? []).map((row) => row.slug);
}

/**
 * One card per published course with a published lesson, with this viewer's
 * progress and access.
 */
export async function loadCourseList(): Promise<CourseCard[]> {
  const [slugs, progress, viewer, ctx] = await Promise.all([
    readPublishedSlugs(),
    getMyLessonProgress(),
    getCourseViewer(),
    getCourseAccessContext(),
  ]);
  const courses = await Promise.all(slugs.map((slug) => getPublishedCourse(slug)));

  return courses.flatMap((course) => {
    if (course === null) return [];
    const canOpen = canOpenCourse(
      { slug: course.slug, activeOnly: course.activeOnly },
      viewer,
      ctx
    );
    const card = courseCardFor(course, progress, canOpen);
    return card === null ? [] : [card];
  });
}
