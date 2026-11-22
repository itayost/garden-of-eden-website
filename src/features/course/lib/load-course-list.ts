import "server-only";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  getCourseViewer,
  getMyLessonProgress,
  getPublishedCourse,
} from "./actions/course-read";
import { canOpenCourse } from "./course-access-rule";
import { getCourseAccessContext } from "./course-access-context";
import { countCourseProgress } from "./progress-utils";

export interface CourseCard {
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  coverUrl: string | null;
  done: number;
  total: number;
  canOpen: boolean;
}

/** Published course slugs in the order admins set. */
async function readPublishedSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "courses")
    .select("slug")
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  if (error) {
    console.error("loadCourseList slugs failed:", error);
    return [];
  }
  return ((data ?? []) as { slug: string }[]).map((row) => row.slug);
}

/** One card per published course, with this viewer's progress and access. */
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
    const { done, total } = countCourseProgress(course.chapters, progress);
    return [
      {
        slug: course.slug,
        titleHe: course.titleHe,
        descriptionHe: course.descriptionHe,
        coverUrl: course.coverUrl,
        done,
        total,
        canOpen: canOpenCourse(
          { slug: course.slug, activeOnly: course.activeOnly },
          viewer,
          ctx
        ),
      },
    ];
  });
}
