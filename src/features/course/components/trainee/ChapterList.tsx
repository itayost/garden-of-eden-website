import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandProgress } from "@/components/ui/brand-progress";
import {
  countChapterProgress,
  findResumePoint,
  formatDuration,
} from "@/features/course/lib/progress-utils";
import type {
  CourseChapterWithLessons,
  LessonProgressMap,
} from "@/features/course/lib/types";

interface ChapterListProps {
  chapters: CourseChapterWithLessons[];
  progress: LessonProgressMap;
}

export function ChapterList({ chapters, progress }: ChapterListProps) {
  return (
    <ul className="space-y-2">
      {chapters.map((chapter, index) => {
        const counts = countChapterProgress(chapter, progress);
        const complete = counts.total > 0 && counts.done === counts.total;
        const started = counts.done > 0;
        const seconds = chapter.lessons.reduce(
          (n, lesson) => n + lesson.durationSec,
          0
        );

        // Open the chapter where the trainee left off inside it, not always at
        // its first lesson.
        const entry = findResumePoint([chapter], progress);
        const disabled = chapter.lessons.length === 0;

        const body = (
          <>
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                complete
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              aria-hidden="true"
            >
              {complete ? <Check className="h-4 w-4" /> : index}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {chapter.titleHe}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {chapter.lessons.length} שיעורים · {formatDuration(seconds)}
              </span>
              {started && !complete && (
                <BrandProgress
                  value={counts.done}
                  max={counts.total}
                  size="sm"
                  className="mt-2"
                  label={`${chapter.titleHe}: ${counts.done} מתוך ${counts.total}`}
                />
              )}
            </span>

            {!disabled && (
              <ChevronLeft
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </>
        );

        const className = cn(
          "flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start",
          disabled
            ? "opacity-60"
            : "transition-colors hover:border-primary/40 hover:bg-muted/50"
        );

        return (
          <li key={chapter.id}>
            {disabled || !entry ? (
              <div className={className}>{body}</div>
            ) : (
              <Link
                href={`/dashboard/course/${chapter.slug}/${entry.lesson.slug}`}
                className={className}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
