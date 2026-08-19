import Link from "next/link";
import { Award, ChevronLeft } from "lucide-react";
import { formatDuration } from "@/features/course/lib/progress-utils";
import type { CourseChapterWithLessons } from "@/features/course/lib/types";

interface ChapterCompleteCardProps {
  chapter: CourseChapterWithLessons;
  /** The chapter to offer next, or null when this was the last one. */
  nextChapter: CourseChapterWithLessons | null;
  nextChapterHref: string | null;
}

/**
 * Shown once every lesson in the chapter is done. Worth designing as a moment
 * rather than a toast — and it hands the trainee somewhere to go next instead of
 * dead-ending.
 */
export function ChapterCompleteCard({
  chapter,
  nextChapter,
  nextChapterHref,
}: ChapterCompleteCardProps) {
  const seconds = chapter.lessons.reduce((n, l) => n + l.durationSec, 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-forest/15 via-forest/5 to-background p-5 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-5"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 32px, currentColor 32px, currentColor 33px), repeating-linear-gradient(90deg, transparent, transparent 32px, currentColor 32px, currentColor 33px)",
        }}
      />

      <div className="relative">
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-forest"
          aria-hidden="true"
        >
          <Award className="h-7 w-7" />
        </span>

        <p className="mt-3 text-lg font-black">כל הכבוד!</p>
        <p className="mt-1 text-xs text-muted-foreground">
          סיימת את {chapter.titleHe}
        </p>

        {/* dt precedes dd so the term/definition pairing survives a screen
            reader; flex-col-reverse puts the number on top visually. */}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="flex flex-col-reverse">
            <dt className="text-[11px] text-muted-foreground">שיעורים</dt>
            <dd className="text-xl font-black tabular-nums text-primary">
              {chapter.lessons.length}
            </dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-[11px] text-muted-foreground">זמן צפייה</dt>
            <dd className="text-xl font-black tabular-nums text-primary">
              {formatDuration(seconds)}
            </dd>
          </div>
        </dl>

        {nextChapter && nextChapterHref && (
          <Link
            href={nextChapterHref}
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            המשך ל{nextChapter.titleHe}
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
