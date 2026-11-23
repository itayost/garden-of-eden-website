import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { lessonsByChapter, type LessonViews } from "@/features/course/lib/lesson-views";

interface LessonViewsListProps {
  lessons: readonly LessonViews[];
}

/**
 * Per lesson: how many trainees started it, how many finished it, and their
 * names. Each lesson opens on its own (details/summary), so the page needs no
 * client code and a long course stays scannable.
 */
export function LessonViewsList({ lessons }: LessonViewsListProps) {
  if (lessons.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        אין שיעורים שפורסמו בקורס הזה.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        התחילו: כל מי שניגן את השיעור. סיימו: מי שצפה בו עד 90% ממנו.
      </p>

      {lessonsByChapter(lessons).map((chapter) => (
        <section key={chapter.chapterId} className="space-y-1.5">
          <h3 className="text-sm font-bold text-muted-foreground">{chapter.titleHe}</h3>
          <ul className="space-y-1.5">
            {chapter.lessons.map((lesson) => (
              <li key={lesson.lessonId}>
                <LessonViewsRow lesson={lesson} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LessonViewsRow({ lesson }: { lesson: LessonViews }) {
  return (
    <details className="group rounded-lg border border-border open:border-primary/40">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{lesson.titleHe}</span>
        <span className="shrink-0 text-xs tabular-nums">
          <span className="font-bold text-primary">{lesson.finishedCount}</span>
          <span className="text-muted-foreground"> סיימו · </span>
          <span className="font-bold">{lesson.startedCount}</span>
          <span className="text-muted-foreground"> התחילו</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="border-t border-border px-3 py-2">
        {lesson.viewers.length === 0 ? (
          <p className="text-sm text-muted-foreground">עוד אף מתאמן לא צפה בשיעור הזה.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {lesson.viewers.map((viewer) => (
              <li
                key={viewer.userId}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  viewer.finished
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {viewer.fullName}
                <span className="ms-1 text-[0.7rem] opacity-80">
                  {viewer.finished ? "סיים" : "התחיל"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
