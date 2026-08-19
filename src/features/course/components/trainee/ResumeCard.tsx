import Link from "next/link";
import { Play } from "lucide-react";
import { BrandProgress } from "@/components/ui/brand-progress";
import { formatDuration } from "@/features/course/lib/progress-utils";
import type { ResumePoint } from "@/features/course/lib/types";

interface ResumeCardProps {
  point: ResumePoint;
}

/**
 * The most-tapped thing on the course home, so it sits above the chapter list.
 * Reads as "carry on" for a lesson in progress and "start here" otherwise.
 */
export function ResumeCard({ point }: ResumeCardProps) {
  const { chapter, lesson, positionSec } = point;
  const started = positionSec > 0;
  const remaining = Math.max(lesson.durationSec - positionSec, 0);

  return (
    <Link
      href={`/dashboard/course/${chapter.slug}/${lesson.slug}`}
      className="block rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
        {started ? "המשך מאיפה שהפסקת" : "מתחילים כאן"}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <span
          className="grid h-11 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-forest to-forest-light text-primary"
          aria-hidden="true"
        >
          <Play className="h-4 w-4 fill-current" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{lesson.titleHe}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {started
              ? `נותרו ${formatDuration(remaining)} מתוך ${formatDuration(lesson.durationSec)}`
              : `${chapter.titleHe} · ${formatDuration(lesson.durationSec)}`}
          </span>
        </span>
      </div>

      {started && lesson.durationSec > 0 && (
        <BrandProgress
          value={positionSec}
          max={lesson.durationSec}
          size="sm"
          className="mt-3"
          label={`התקדמות בשיעור ${lesson.titleHe}`}
        />
      )}
    </Link>
  );
}
