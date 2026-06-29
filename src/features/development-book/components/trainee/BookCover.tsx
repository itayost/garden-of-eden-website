import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgeGroup, BookCategoryWithParameters } from "@/features/development-book/lib/types";

interface BookCoverProps {
  categories: BookCategoryWithParameters[];
  ageGroup: AgeGroup | null;
  position: string | null;
  showAll: boolean;
}

export function BookCover({ categories, ageGroup, position, showAll }: BookCoverProps) {
  const totalParameters = categories.reduce((sum, cat) => sum + cat.parameters.length, 0);
  const totalDrills = categories.reduce(
    (sum, cat) =>
      sum + cat.parameters.reduce((pSum, param) => pSum + param.drills.length, 0),
    0
  );

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden mb-8",
        "bg-gradient-to-br from-primary/20 via-primary/10 to-background",
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
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            ספר פיתוח
            <br />
            <span className="text-primary">שחקן</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-light">
            מסלול מאורגן לפיתוח מיומנויות כדורגל
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-0.5 bg-gradient-to-r from-primary to-yellow-400 rounded-full" />

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

        {/* Context chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {ageGroup && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              <BookOpen className="h-3 w-3 shrink-0" />
              {ageGroup}
            </span>
          )}
          {position && (
            <span className="inline-flex items-center rounded-full bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
              {position}
            </span>
          )}
          {showAll && (
            <span className="inline-flex items-center rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              כל התכנים
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
