import { cn } from "@/lib/utils";

/** A Question's number in a small tile, the way the builder and the grid headers number them. */
export function QuestionChip({ number, className }: { number: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid size-[22px] shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold tabular-nums text-secondary-foreground",
        className,
      )}
    >
      {number}
    </span>
  );
}
