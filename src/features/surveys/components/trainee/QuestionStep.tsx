"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { chooseOne, rate, toggleOption, writeText, type AnswerMap } from "../../lib/popup-answers";
import type { SurveyQuestion } from "../../lib/types";
import { FreeText, MultiChoice, RatingScale, SingleChoice } from "./AnswerControls";
import { FAINT_TEXT, RAISED, SOFT_TEXT } from "./sheet-styles";
import { useFocusOnMount } from "./useFocusOnMount";

interface QuestionStepProps {
  question: SurveyQuestion;
  /** 1-based position of the Question, for "שאלה i מתוך n". */
  number: number;
  total: number;
  answers: AnswerMap;
  onChange: (next: AnswerMap) => void;
}

function Control({
  question,
  answers,
  onChange,
  labelledBy,
}: Omit<QuestionStepProps, "number" | "total"> & { labelledBy: string }) {
  const answer = answers[question.id];
  switch (question.kind) {
    case "rating":
      return (
        <RatingScale
          question={question}
          labelledBy={labelledBy}
          value={answer?.rating}
          onSelect={(rating) => onChange(rate(answers, question.id, rating))}
        />
      );
    case "single_choice":
      return (
        <SingleChoice
          question={question}
          labelledBy={labelledBy}
          selectedId={answer?.optionIds?.[0]}
          onSelect={(optionId) => onChange(chooseOne(answers, question.id, optionId))}
        />
      );
    case "multi_choice":
      return (
        <MultiChoice
          question={question}
          labelledBy={labelledBy}
          selectedIds={answer?.optionIds ?? []}
          onToggle={(optionId) => onChange(toggleOption(answers, question.id, optionId))}
        />
      );
    case "text":
      return (
        <FreeText
          labelledBy={labelledBy}
          value={answer?.text ?? ""}
          optional={!question.required}
          onChange={(text) => onChange(writeText(answers, question.id, text))}
        />
      );
  }
}

/** One Question on its own screen: where the Trainee is, the Question, and its control. */
export function QuestionStep({ question, number, total, answers, onChange }: QuestionStepProps) {
  const headingId = useId();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div>
      <p className={cn("mt-5 mb-1.5 flex items-center gap-2 text-[13px] tabular-nums", FAINT_TEXT)}>
        <span>
          שאלה {number} מתוך {total}
        </span>
        {!question.required && (
          <span className={cn("h-[22px] rounded-md px-2 text-xs leading-5", RAISED, SOFT_TEXT)}>
            לא חובה
          </span>
        )}
      </p>
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="mb-5 text-[26px] leading-tight font-extrabold tracking-tight text-balance outline-none"
      >
        {question.text}
      </h3>
      {question.kind === "multi_choice" && (
        <p className={cn("-mt-3 mb-4 text-[13px]", FAINT_TEXT)}>אפשר לבחור כמה תשובות</p>
      )}
      <Control question={question} answers={answers} onChange={onChange} labelledBy={headingId} />
    </div>
  );
}
