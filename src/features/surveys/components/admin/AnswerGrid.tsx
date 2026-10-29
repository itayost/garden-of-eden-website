"use client";

import { useMemo, useState } from "react";

import type { GridRow, QuestionSummary } from "../../lib/report";
import type { SurveyQuestion } from "../../lib/types";
import { GridTable } from "./GridTable";
import { PhoneCards } from "./PhoneCards";
import { QuestionResultsSheet } from "./QuestionResultsSheet";
import { ResponseSheet } from "./ResponseSheet";
import { ResultsPager } from "./ResultsPager";

interface AnswerGridProps {
  questions: readonly SurveyQuestion[];
  summaries: readonly QuestionSummary[];
  /** The current page of Responses. */
  rows: readonly GridRow[];
  /** How many Responses the summary row sums up. */
  answeredTotal: number;
  /** How many Responses match the search, for the pager. */
  rowCount: number;
  /** The 1-based page being shown. */
  page: number;
}

/**
 * The answers: a spreadsheet on a desktop, a card per Trainee on a phone. A
 * Question header opens that Question's full results and a row opens that
 * Trainee's Response; both are sheets over the page.
 */
export function AnswerGrid({ questions, summaries, rows, answeredTotal, rowCount, page }: AnswerGridProps) {
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [row, setRow] = useState<GridRow | null>(null);
  const summaryById = useMemo(
    () => new Map(summaries.map((summary) => [summary.questionId, summary])),
    [summaries],
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden md:block">
          <GridTable
            questions={questions}
            summaries={summaryById}
            rows={rows}
            answeredTotal={answeredTotal}
            onOpenQuestion={setQuestionId}
            onOpenRow={setRow}
          />
        </div>
        <div className="md:hidden">
          <PhoneCards questions={questions} rows={rows} onOpenRow={setRow} />
        </div>
        <ResultsPager total={rowCount} page={page} />
      </div>
      <QuestionResultsSheet
        questions={questions}
        summaries={summaries}
        questionId={questionId}
        onClose={() => setQuestionId(null)}
      />
      <ResponseSheet questions={questions} row={row} onClose={() => setRow(null)} />
    </>
  );
}
