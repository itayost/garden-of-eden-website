import { cn } from "@/lib/utils";

/**
 * The A mark by a trainee's name: staff cleared him to train with an older
 * birth year. Set on the trainee page (PlaysUpToggle).
 */
export function PlaysUpMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-forest px-1 text-[10px] font-bold leading-none text-cream",
        className,
      )}
      title="יכול לעלות שנתון"
      role="img"
      aria-label="A: יכול לעלות שנתון"
    >
      A
    </span>
  );
}
