"use client";

import { useState } from "react";

import type { QuestionSummary } from "../../lib/report";
import { summaryValueText } from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";
import { QuestionChip } from "./QuestionChip";
import { QuestionResultsSheet } from "./QuestionResultsSheet";

interface PhoneSummaryListProps {
  questions: readonly SurveyQuestion[];
  summaries: readonly QuestionSummary[];
}

/**
 * The grid's summary row on a phone: one line per Question with its top answer
 * or average, folded away with a tap. A line opens the Question's full results.
 */
export function PhoneSummaryList({ questions, summaries }: PhoneSummaryListProps) {
  const [questionId, setQuestionId] = useState<string | null>(null);

  return (
    <>
      <details open className="rounded-xl border bg-card px-3.5 py-1 md:hidden">
        <summary className="cursor-pointer py-2.5 text-sm font-bold">סיכום לפי שאלה</summary>
        <ul>
          {questions.map((question, index) => {
            const summary = summaries.find((candidate) => candidate.questionId === question.id);
            return (
              <li key={question.id}>
                <button
                  type="button"
                  onClick={() => setQuestionId(question.id)}
                  className="grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 border-t py-2.5 text-start text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <QuestionChip number={index + 1} />
                  <span className="truncate text-muted-foreground">{question.text}</span>
                  <span className="font-bold tabular-nums">
                    {summary === undefined ? "" : summaryValueText(summary)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      <QuestionResultsSheet
        questions={questions}
        summaries={summaries}
        questionId={questionId}
        onClose={() => setQuestionId(null)}
      />
    </>
  );
}
