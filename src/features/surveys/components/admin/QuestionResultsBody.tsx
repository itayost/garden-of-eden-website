import { cn } from "@/lib/utils";
import type { QuestionSummary } from "../../lib/report";
import {
  averageText,
  branchYearText,
  displayName,
  israelDayMonth,
  scaledHeights,
} from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";

type ChoiceSummary = Extract<QuestionSummary, { kind: "single_choice" | "multi_choice" }>;
type RatingSummary = Extract<QuestionSummary, { kind: "rating" }>;
type TextSummary = Extract<QuestionSummary, { kind: "text" }>;

const RATING_BAR_MAX_PX = 64;
const RATING_BAR_MIN_PX = 4;
const MULTI_CHOICE_NOTE = "אפשר היה לבחור כמה תשובות, ולכן האחוזים מסתכמים ביותר מ-100%.";

function ChoiceResults({ summary }: { summary: ChoiceSummary }) {
  const most = Math.max(...summary.options.map((option) => option.count));
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {summary.options.map((option) => {
          const isTop = most > 0 && option.count === most;
          return (
            <li key={option.optionId}>
              <div className="flex items-baseline gap-2.5 text-sm">
                <span className={cn("min-w-0 break-words", isTop && "font-semibold")}>{option.label}</span>
                <span className="ms-auto text-[13px] tabular-nums text-muted-foreground">{option.count}</span>
                <span className="min-w-[3.2em] text-end font-bold tabular-nums">{option.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded bg-muted">
                <div
                  className={cn("h-full rounded", isTop ? "bg-primary" : "bg-primary/55")}
                  style={{ inlineSize: option.count === 0 ? 0 : `${Math.max(option.pct, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {summary.kind === "multi_choice" && (
        <p className="text-xs text-muted-foreground">{MULTI_CHOICE_NOTE}</p>
      )}
    </div>
  );
}

function RatingResults({ summary, question }: { summary: RatingSummary; question: SurveyQuestion }) {
  const heights = scaledHeights(summary.counts, RATING_BAR_MAX_PX, RATING_BAR_MIN_PX);
  const most = Math.max(...summary.counts);
  return (
    <div className="flex items-end gap-5">
      <div>
        <div className="text-4xl font-extrabold leading-none tabular-nums">{averageText(summary.average)}</div>
        <span className="mt-1.5 block text-[13px] font-medium text-muted-foreground">ממוצע מתוך 5</span>
      </div>
      <div className="min-w-0 flex-1">
        <ol className="grid h-28 grid-cols-5 items-end gap-1.5">
          {summary.counts.map((count, index) => (
            <li key={index + 1} className="flex h-full flex-col items-center justify-end gap-1">
              <b className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</b>
              <span
                style={{ blockSize: heights[index] }}
                className={cn(
                  "block w-full max-w-11 rounded-t-[5px] bg-primary/50",
                  most > 0 && count === most && "bg-primary",
                )}
              />
              <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
            </li>
          ))}
        </ol>
        {/* Both ends are always drawn so a single label keeps to its own side. */}
        <div className="mt-2 flex justify-between border-t pt-1.5 text-xs text-muted-foreground">
          <span>{question.lowLabel}</span>
          <span>{question.highLabel}</span>
        </div>
      </div>
    </div>
  );
}

/** "חיפה · 2014 · 28.10": where the answer came from and when. */
function sourceText(answer: TextSummary["texts"][number]): string {
  return [branchYearText(answer.branchNames, answer.birthYear), israelDayMonth(answer.submittedAt)]
    .filter((part) => part !== "")
    .join(" · ");
}

function TextResults({ summary }: { summary: TextSummary }) {
  return (
    <ul className="divide-y">
      {summary.texts.map((answer) => (
        <li key={answer.profileId} className="py-3 first:pt-0">
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{answer.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <b className="font-semibold text-foreground">{displayName(answer.fullName)}</b> · {sourceText(answer)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Everything one Question got: option bars, the rating distribution, or every written answer. */
export function QuestionResultsBody({
  question,
  summary,
}: {
  question: SurveyQuestion;
  summary: QuestionSummary;
}) {
  if (summary.answered === 0) {
    return <p className="text-sm text-muted-foreground">עוד אף אחד לא ענה על השאלה הזאת</p>;
  }
  if (summary.kind === "rating") return <RatingResults summary={summary} question={question} />;
  if (summary.kind === "text") return <TextResults summary={summary} />;
  return <ChoiceResults summary={summary} />;
}
