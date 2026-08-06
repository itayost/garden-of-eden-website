import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { countDoneInParameter } from "@/features/development-book/lib/progress-utils";
import type {
  AgeGroup,
  BookCategoryWithParameters,
  DrillProgressMap,
} from "@/features/development-book/lib/types";

interface BookCoverProps {
  categories: BookCategoryWithParameters[];
  ageGroup: AgeGroup | null;
  position: string | null;
  showAll: boolean;
  doneMap: DrillProgressMap;
}

export function BookCover({
  categories,
  ageGroup,
  position,
  showAll,
  doneMap,
}: BookCoverProps) {
  const totalParameters = categories.reduce(
    (sum, cat) => sum + cat.parameters.length,
    0
  );
  const totalDrills = categories.reduce(
    (sum, cat) =>
      sum + cat.parameters.reduce((pSum, param) => pSum + param.drills.length, 0),
    0
  );

  // Aggregate progress across all parameters in all categories
  const { doneDrills } = categories.reduce(
    (acc, cat) => {
      for (const param of cat.parameters) {
        const counts = countDoneInParameter(param, doneMap);
        acc.doneDrills += counts.done;
      }
      return acc;
    },
    { doneDrills: 0 }
  );

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden mb-8",
        "bg-gradient-to-br from-forest/15 via-forest/5 to-background",
        "border border-primary/20 p-6 sm:p-10"
      )}
    >
      {/* Decorative background pattern */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 40px, currentColor 40px, currentColor 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)",
        }}
      />

      <div className="relative space-y-4">
        {/* Brand label */}
        <p className="text-xs font-bold tracking-widest text-primary uppercase">
          Garden of Eden
        </p>

        {/* Title */}
        <div>
          <h1 className="font-display text-4xl leading-tight text-forest sm:text-6xl">
            ספר פיתוח
            <br />
            <span className="gradient-text-gold">שחקן</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-light">
            מסלול מאורגן לפיתוח מיומנויות כדורגל
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-0.5 bg-gradient-to-l from-grass to-gold rounded-full" />

        {/* Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-3xl font-extrabold text-primary leading-none">
              {categories.length}
            </p>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
              קטגוריות
            </p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-primary leading-none">
              {totalParameters}
            </p>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
              פרמטרים
            </p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-primary leading-none">
              {totalDrills}
            </p>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
              תרגילים
            </p>
          </div>
        </div>

        {/* Progress block */}
        {totalDrills > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {doneDrills}/{totalDrills} תרגילים הושלמו
            </p>
            <Progress value={doneDrills} max={totalDrills} className="h-2" />
          </div>
        )}

        {/* Context chips + parents CTA row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {ageGroup && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              <BookOpen className="h-3 w-3 shrink-0" />
              {ageGroup}
            </span>
          )}
          {position && (
            <span className="inline-flex items-center rounded-full bg-gold/10 border border-gold/25 px-3 py-1 text-xs font-semibold text-gold">
              {position}
            </span>
          )}
          {showAll && (
            <span className="inline-flex items-center rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              כל התכנים
            </span>
          )}

          {/* Parents CTA */}
          <Link
            href="/dashboard/book/parents"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full",
              "bg-sky-500/10 border border-sky-400/30 px-3 py-1",
              "text-xs font-semibold text-sky-600 dark:text-sky-400",
              "hover:bg-sky-500/20 transition-colors"
            )}
          >
            תוכן להורים
          </Link>
        </div>
      </div>
    </div>
  );
}
