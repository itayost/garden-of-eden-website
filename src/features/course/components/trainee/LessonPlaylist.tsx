import Link from "next/link";
import { Check, Circle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  isLessonDone,
} from "@/features/course/lib/progress-utils";
import type {
  CourseChapterWithLessons,
  LessonProgressMap,
} from "@/features/course/lib/types";

interface LessonPlaylistProps {
  chapter: CourseChapterWithLessons;
  currentLessonId: string;
  progress: LessonProgressMap;
}

/**
 * The chapter's lessons, listed under the player so moving between them never
 * costs a trip back to the course home.
 */
export function LessonPlaylist({
  chapter,
  currentLessonId,
  progress,
}: LessonPlaylistProps) {
  return (
    <section aria-labelledby="playlist-heading" className="space-y-2">
      <h2
        id="playlist-heading"
        className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
      >
        שיעורי הפרק
      </h2>

      <ul>
        {chapter.lessons.map((lesson, index) => {
          const current = lesson.id === currentLessonId;
          const done = isLessonDone(lesson.id, progress);

          return (
            <li key={lesson.id}>
              <Link
                href={`/dashboard/course/${chapter.slug}/${lesson.slug}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  current ? "bg-primary/10 font-bold" : "hover:bg-muted/60"
                )}
              >
                {current ? (
                  <Play
                    className="h-3.5 w-3.5 shrink-0 fill-current text-primary"
                    aria-label="מנגן כעת"
                  />
                ) : done ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    aria-label="הושלם"
                  />
                ) : (
                  <Circle
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}

                <span
                  className="w-7 shrink-0 text-xs text-muted-foreground tabular-nums"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1 truncate">
                  {lesson.titleHe}
                </span>

                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDuration(lesson.durationSec)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
