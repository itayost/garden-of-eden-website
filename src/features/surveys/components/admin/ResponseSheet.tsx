"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { joinDot } from "../../lib/format";
import type { GridRow } from "../../lib/report";
import { branchYearText, displayName, sentAtText } from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";
import { AnswerCell } from "./AnswerCell";
import { QuestionChip } from "./QuestionChip";
import { useLastShown } from "./useLastShown";

interface ResponseSheetProps {
  questions: readonly SurveyQuestion[];
  /** The Response to show, or null while the sheet is closed. */
  row: GridRow | null;
  onClose: () => void;
}

/** One Trainee's Response: every Question with the answer, and the way to their page. */
export function ResponseSheet({ questions, row, onClose }: ResponseSheetProps) {
  const shown = useLastShown(row);

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {shown !== null && (
          <>
            <SheetHeader className="border-b pe-12 text-start">
              <SheetTitle className="text-base font-bold">{displayName(shown.fullName)}</SheetTitle>
              <SheetDescription className="text-xs">
                {joinDot([branchYearText(shown.branchNames, shown.birthYear), `נשלח ${sentAtText(shown.submittedAt)}`])}
              </SheetDescription>
            </SheetHeader>
            <ol className="divide-y px-4">
              {questions.map((question, index) => (
                <li key={question.id} className="flex gap-2.5 py-3.5">
                  <QuestionChip number={index + 1} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{question.text}</p>
                    <div className="mt-1.5">
                      <AnswerCell kind={question.kind} cell={shown.answers[question.id]} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <SheetFooter className="border-t">
              <Button asChild variant="outline">
                <Link href={`/admin/users/${shown.profileId}`}>
                  <ExternalLink aria-hidden="true" />
                  לדף החניך
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
