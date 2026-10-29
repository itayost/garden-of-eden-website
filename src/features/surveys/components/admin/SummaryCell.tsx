import { cn } from "@/lib/utils";
import type { QuestionSummary, RatingCounts } from "../../lib/report";
import { averageText, scaledHeights, topOptions } from "../../lib/results-view";

const MINI_BAR_MAX_PX = 28;
const MINI_BAR_MIN_PX = 3;

/** Five small bars for the counts of 1 to 5; the tallest is the strong green. */
function RatingMiniBars({ counts }: { counts: RatingCounts }) {
  const heights = scaledHeights(counts, MINI_BAR_MAX_PX, MINI_BAR_MIN_PX);
  const tallest = Math.max(...counts);
  return (
    <span
      role="img"
      aria-label={`כמה נתנו כל דירוג, מ-1 עד 5: ${counts.join(", ")}`}
      className="flex h-7 items-end gap-[3px]"
    >
      {heights.map((height, index) => (
        <span
          key={index + 1}
          style={{ blockSize: height }}
          className={cn(
            "block w-[9px] rounded-t-sm bg-primary/50",
            tallest > 0 && counts[index] === tallest && "bg-primary",
          )}
        />
      ))}
    </span>
  );
}

const NO_ANSWERS = <span className="text-xs text-muted-foreground">אין תשובות</span>;

/** What the summary row shows under one Question: the top of its results. */
export function SummaryCell({ summary }: { summary: QuestionSummary }) {
  if (summary.kind === "rating") {
    return (
      <div className="flex items-end gap-2.5">
        <b className="text-xl font-extrabold leading-none tabular-nums">{averageText(summary.average)}</b>
        <RatingMiniBars counts={summary.counts} />
      </div>
    );
  }
  if (summary.kind === "text") {
    return (
      <div className="text-xs">
        <b className="tabular-nums">{summary.answered}</b> כתבו
      </div>
    );
  }
  const [first, second] = topOptions(summary.options, 2);
  if (first === undefined) return NO_ANSWERS;
  return (
    <div className="text-xs leading-relaxed">
      <div>
        <b className="tabular-nums">{first.pct}%</b> {first.label}
      </div>
      {second !== undefined && (
        <div className="text-muted-foreground">
          <span className="tabular-nums">{second.pct}%</span> {second.label}
        </div>
      )}
    </div>
  );
}
