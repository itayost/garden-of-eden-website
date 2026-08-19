import { cn } from "@/lib/utils";
import { formatDuration } from "@/features/course/lib/progress-utils";
import type { CourseChapterWithLessons } from "@/features/course/lib/types";

interface CourseCoverProps {
  titleHe: string;
  descriptionHe: string | null;
  chapters: CourseChapterWithLessons[];
}

/**
 * Course hero. Mirrors BookCover's treatment — forest gradient, faint pitch
 * grid, gold-to-grass rule — so the course reads as part of the same product.
 */
export function CourseCover({
  titleHe,
  descriptionHe,
  chapters,
}: CourseCoverProps) {
  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0);
  const totalSeconds = chapters.reduce(
    (sum, chapter) =>
      sum + chapter.lessons.reduce((n, lesson) => n + lesson.durationSec, 0),
    0
  );

  return (
    <div
      className={cn(
        "relative mb-6 overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-forest/15 via-forest/5 to-background",
        "border border-primary/20 p-6 sm:p-10"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-5"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 40px, currentColor 40px, currentColor 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)",
        }}
      />

      <div className="relative space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Garden of Eden
        </p>

        <h1 className="text-2xl font-black leading-tight sm:text-4xl">
          {titleHe}
        </h1>

        {descriptionHe && (
          <p className="max-w-prose text-sm text-muted-foreground">
            {descriptionHe}
          </p>
        )}

        <div
          className="h-0.5 w-14 rounded-full bg-gradient-to-l from-gold to-primary"
          aria-hidden="true"
        />

        <p className="text-sm text-muted-foreground tabular-nums">
          {chapters.length} פרקים · {lessonCount} שיעורים ·{" "}
          {formatDuration(totalSeconds)} שעות צפייה
        </p>
      </div>
    </div>
  );
}
