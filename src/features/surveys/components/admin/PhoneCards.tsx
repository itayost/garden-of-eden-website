import { Fragment } from "react";

import type { GridRow } from "../../lib/report";
import { sentAtText } from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";
import { AnswerCell } from "./AnswerCell";
import { PersonBlock } from "./PersonBlock";
import { QuestionChip } from "./QuestionChip";

interface PhoneCardsProps {
  questions: readonly SurveyQuestion[];
  rows: readonly GridRow[];
  onOpenRow: (row: GridRow) => void;
}

/** The grid on a phone: a card per Trainee, the answers listed by Question number. */
export function PhoneCards({ questions, rows, onOpenRow }: PhoneCardsProps) {
  return (
    <div className="divide-y">
      {rows.map((row) => (
        <article key={row.profileId} className="p-3.5">
          <button
            type="button"
            onClick={() => onOpenRow(row)}
            className="mb-2.5 flex w-full items-center gap-2 rounded-md text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <PersonBlock fullName={row.fullName} branchNames={row.branchNames} birthYear={row.birthYear} />
            <span className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {sentAtText(row.submittedAt)}
            </span>
            <span className="sr-only">, לתשובות המלאות</span>
          </button>
          <dl className="grid grid-cols-[22px_1fr] gap-x-2 gap-y-1.5 text-[13px]">
            {questions.map((question, index) => (
              <Fragment key={question.id}>
                <dt>
                  <QuestionChip number={index + 1} />
                  <span className="sr-only">שאלה {index + 1}</span>
                </dt>
                <dd className="m-0 self-center">
                  <AnswerCell kind={question.kind} cell={row.answers[question.id]} />
                </dd>
              </Fragment>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}
