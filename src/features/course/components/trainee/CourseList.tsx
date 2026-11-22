import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { courseHref } from "@/features/course/lib/course-slugs";
import type { CourseCard } from "@/features/course/lib/load-course-list";

interface CourseListProps {
  courses: CourseCard[];
}

export function CourseList({ courses }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        עוד אין קורסים. נעדכן כשיעלה קורס חדש.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">קורסים</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <li key={course.slug}>
            <CourseCardLink course={course} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseCardLink({ course }: { course: CourseCard }) {
  return (
    <Link
      href={courseHref(course.slug)}
      className={cn(
        "group relative block h-full overflow-hidden rounded-2xl p-5",
        "bg-gradient-to-br from-forest/15 via-forest/5 to-background",
        "border border-primary/20 transition-colors hover:border-primary/50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      )}
    >
      {course.coverUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50"
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative space-y-2">
        <h2 className="text-lg font-black leading-tight">{course.titleHe}</h2>
        {course.descriptionHe && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.descriptionHe}
          </p>
        )}
        <div
          className="h-0.5 w-10 rounded-full bg-gradient-to-l from-gold to-primary"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground tabular-nums">
          {course.done} מתוך {course.total} שיעורים
        </p>
        {!course.canOpen && (
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            הקורס פתוח למתאמנים פעילים
          </p>
        )}
      </div>
    </Link>
  );
}
