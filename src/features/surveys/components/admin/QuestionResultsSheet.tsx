"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { joinDot } from "../../lib/format";
import type { QuestionSummary } from "../../lib/report";
import type { SurveyQuestion } from "../../lib/types";
import { KIND_META } from "./kind-meta";
import { QuestionChip } from "./QuestionChip";
import { QuestionResultsBody } from "./QuestionResultsBody";
import { useLastShown } from "./useLastShown";

interface QuestionResultsSheetProps {
  questions: readonly SurveyQuestion[];
  summaries: readonly QuestionSummary[];
  /** The Question to show, or null while the sheet is closed. */
  questionId: string | null;
  onClose: () => void;
}

function sheetNote(question: SurveyQuestion, answered: number): string {
  return joinDot([KIND_META[question.kind].label, question.required ? "" : "לא חובה", `ענו ${answered}`]);
}

/** The full results of one Question, opened from its grid header or its line in the phone summary. */
export function QuestionResultsSheet({ questions, summaries, questionId, onClose }: QuestionResultsSheetProps) {
  const shownId = useLastShown(questionId);
  const index = questions.findIndex((question) => question.id === shownId);
  const question = index === -1 ? undefined : questions[index];
  const summary = summaries.find((candidate) => candidate.questionId === shownId);

  return (
    <Sheet open={questionId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {question !== undefined && summary !== undefined && (
          <>
            <SheetHeader className="border-b pe-12 text-start">
              <div className="flex items-start gap-2.5">
                <QuestionChip number={index + 1} className="mt-0.5 size-[26px] text-[13px]" />
                <div className="min-w-0">
                  <SheetTitle className="text-base font-bold leading-snug">{question.text}</SheetTitle>
                  <SheetDescription className="mt-1 text-xs">{sheetNote(question, summary.answered)}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="p-4">
              <QuestionResultsBody question={question} summary={summary} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
