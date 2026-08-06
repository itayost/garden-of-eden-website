import { cn } from "@/lib/utils";

interface BrandProgressProps {
  value: number;
  max: number;
  /** Bar thickness. */
  size?: "sm" | "md";
  className?: string;
  /** Accessible label for the progress bar. */
  label?: string;
}

/**
 * The app's signature gold gradient progress bar — the achievements motif,
 * promoted to a single shared implementation (previously hand-built in the
 * workout screen, the videos page, BookCover and AchievementsList).
 */
export function BrandProgress({
  value,
  max,
  size = "md",
  className,
  label,
}: BrandProgressProps) {
  const percentage = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-3",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600 transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
