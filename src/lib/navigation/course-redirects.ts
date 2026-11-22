import {
  courseHref,
  DIGITAL_COURSE_SLUG,
  TACTICAL_COURSE_SLUG,
} from "../../features/course/lib/course-slugs";

export interface CourseRedirect {
  source: string;
  destination: string;
  permanent: true;
}

const OLD_COURSE_BASES: ReadonlyArray<{ oldBase: string; slug: string }> = [
  { oldBase: "/dashboard/course", slug: DIGITAL_COURSE_SLUG },
  { oldBase: "/dashboard/tactical-course", slug: TACTICAL_COURSE_SLUG },
];

/**
 * The two old trainee course addresses, each with its lessons, sent for good
 * to the same place under /dashboard/courses/<slug>. Pure so a test can read it.
 */
export function courseRedirects(): CourseRedirect[] {
  return OLD_COURSE_BASES.flatMap(({ oldBase, slug }) => [
    { source: oldBase, destination: courseHref(slug), permanent: true as const },
    {
      source: `${oldBase}/:path*`,
      destination: `${courseHref(slug)}/:path*`,
      permanent: true as const,
    },
  ]);
}
