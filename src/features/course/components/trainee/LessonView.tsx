"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonPlayer } from "./LessonPlayer";
import { markLessonComplete } from "@/features/course/lib/actions/course-progress";
import type { CourseLesson } from "@/features/course/lib/types";

interface LessonViewProps {
  lesson: CourseLesson;
  chapterTitleHe: string;
  lessonNumber: number;
  lessonTotal: number;
  initialPositionSec: number;
  initialCompleted: boolean;
  /** Href of the next lesson, or null at the end of the course. */
  nextHref: string | null;
}

/**
 * Player plus the controls around it. Client-side because completion state has
 * to update the moment the video crosses the threshold, without a navigation.
 */
export function LessonView({
  lesson,
  chapterTitleHe,
  lessonNumber,
  lessonTotal,
  initialPositionSec,
  initialCompleted,
  nextHref,
}: LessonViewProps) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  // Refresh so the playlist below and the course-level progress catch up.
  const handleCompleted = useCallback(
    (value: boolean) => {
      setCompleted(value);
      if (value) router.refresh();
    },
    [router]
  );

  const handleMarkDone = useCallback(() => {
    startTransition(async () => {
      const result = await markLessonComplete(lesson.id);
      if (result.success) {
        setCompleted(true);
        router.refresh();
      }
    });
  }, [lesson.id, router]);

  return (
    <div className="space-y-4">
      <LessonPlayer
        lessonId={lesson.id}
        durationSec={lesson.durationSec}
        initialPositionSec={initialPositionSec}
        initialCompleted={initialCompleted}
        hasSdRendition={lesson.videoPathSd != null}
        onCompletedChange={handleCompleted}
      />

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          {chapterTitleHe} · שיעור {lessonNumber} מתוך {lessonTotal}
        </p>
        <h1 className="mt-1 text-xl font-black">{lesson.titleHe}</h1>
        {lesson.descriptionHe && (
          <p className="mt-1 text-sm text-muted-foreground">
            {lesson.descriptionHe}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nextHref && (
          <Link
            href={nextHref}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            השיעור הבא
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}

        <button
          type="button"
          onClick={handleMarkDone}
          disabled={completed || pending}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors",
            completed
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border hover:bg-muted",
            pending && "opacity-60"
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {completed ? "הושלם" : "סיימתי"}
        </button>
      </div>
    </div>
  );
}
