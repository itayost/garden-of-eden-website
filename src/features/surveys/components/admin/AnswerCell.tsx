import { cn } from "@/lib/utils";
import { ratingTone, type RatingTone } from "../../lib/format";
import type { CellAnswer } from "../../lib/report";
import type { QuestionKind } from "../../lib/types";

/** Green deepens with the rating; 1 and 2 are amber. Dark text on the light tints keeps the number readable. */
const TONE_CLASS: Record<RatingTone, string> = {
  high: "bg-primary text-primary-foreground",
  mid: "bg-primary/45 text-secondary-foreground",
  soft: "bg-primary/20 text-secondary-foreground",
  low: "bg-warning/30 text-warning-emphasis",
};

function RatingPip({ rating }: { rating: number }) {
  return (
    <span
      className={cn(
        "inline-grid h-[26px] w-7 place-items-center rounded-[7px] text-[13px] font-bold tabular-nums",
        TONE_CLASS[ratingTone(rating)],
      )}
    >
      <span className="sr-only">דירוג </span>
      {rating}
    </span>
  );
}

interface AnswerCellProps {
  kind: QuestionKind;
  /** Undefined when the Question was skipped. */
  cell: CellAnswer | undefined;
  /** Free text is cut to two lines in the grid and shown whole everywhere else. */
  clamp?: boolean;
}

/** One answer: a coloured square, a choice, tags, clipped text, or "לא ענה" when skipped. */
export function AnswerCell({ kind, cell, clamp = false }: AnswerCellProps) {
  if (cell === undefined) {
    return <span className="text-[13px] text-muted-foreground">לא ענה</span>;
  }
  if (cell.rating !== null) return <RatingPip rating={cell.rating} />;
  if (cell.text !== null) {
    return (
      <span className={cn("break-words text-[13px]", clamp && "line-clamp-2 max-w-[220px]")}>
        {cell.text}
      </span>
    );
  }
  if (kind === "multi_choice") {
    return (
      <ul className="flex flex-wrap gap-1">
        {cell.optionLabels.map((label) => (
          <li key={label} className="rounded-[5px] bg-muted px-[7px] py-0.5 text-xs">
            {label}
          </li>
        ))}
      </ul>
    );
  }
  return <span className="break-words text-sm">{cell.optionLabels.join(", ")}</span>;
}
