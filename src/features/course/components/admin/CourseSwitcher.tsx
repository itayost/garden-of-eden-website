import Link from "next/link";

import { cn } from "@/lib/utils";

interface CourseSwitcherProps {
  courses: { slug: string; titleHe: string }[];
  current: string;
  /** "/admin/course" or "/admin/course/progress". */
  basePath: string;
}

/** Tabs between courses; the choice lives in ?course= so it survives reloads. */
export function CourseSwitcher({ courses, current, basePath }: CourseSwitcherProps) {
  if (courses.length < 2) return null;
  return (
    <nav aria-label="בחירת קורס" className="flex flex-wrap gap-2">
      {courses.map((course) => (
        <Link
          key={course.slug}
          href={`${basePath}?course=${course.slug}`}
          aria-current={course.slug === current ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            course.slug === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {course.titleHe}
        </Link>
      ))}
    </nav>
  );
}
