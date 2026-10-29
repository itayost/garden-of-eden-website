"use client";

import { Check } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SURVEY_LIMITS, type SurveyQuestion } from "../../lib/types";
import { CHOSEN, FAINT_TEXT, RAISED_TARGET, SHEET_TEXT } from "./sheet-styles";

/** The four answer controls. Each is a large thumb target, at least 56px tall. */

const ROW =
  "flex min-h-[58px] w-full items-center gap-3 rounded-2xl px-4 text-start text-base font-semibold";

const MARK_OFF = "border-[#F2F5EA]/35";

interface ChoiceProps {
  question: SurveyQuestion;
  /** The id of the element that holds the Question text, which names the group. */
  labelledBy: string;
}

/** One option, as a radio group of `role="radio"` rows (the way PaymentMethodPicker builds one). */
export function SingleChoice({
  question,
  labelledBy,
  selectedId,
  onSelect,
}: ChoiceProps & { selectedId: string | undefined; onSelect: (optionId: string) => void }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {question.options.map((option) => {
        const on = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(option.id)}
            className={cn(ROW, "transition-colors", on ? CHOSEN : RAISED_TARGET)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-[26px] flex-none place-items-center rounded-full border-2",
                on ? "border-brand-lime" : MARK_OFF,
              )}
            >
              {on && <span className="size-3 rounded-full bg-brand-lime" />}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Several options, as real checkboxes inside tappable rows. */
export function MultiChoice({
  question,
  labelledBy,
  selectedIds,
  onToggle,
}: ChoiceProps & { selectedIds: readonly string[]; onToggle: (optionId: string) => void }) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {question.options.map((option) => {
        const on = selectedIds.includes(option.id);
        return (
          <label
            key={option.id}
            className={cn(
              ROW,
              "cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-lime",
              on ? CHOSEN : RAISED_TARGET,
            )}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={on}
              onChange={() => onToggle(option.id)}
            />
            <span
              aria-hidden="true"
              className={cn(
                "grid size-[26px] flex-none place-items-center rounded-lg border-2 text-forest",
                on ? "border-brand-lime bg-brand-lime" : MARK_OFF,
              )}
            >
              {on && <Check className="size-4" strokeWidth={3} />}
            </span>
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

const RATING_VALUES = Array.from(
  { length: SURVEY_LIMITS.ratingMax - SURVEY_LIMITS.ratingMin + 1 },
  (_, index) => SURVEY_LIMITS.ratingMin + index,
);

/** A rating from 1 to 5 as five numbered tiles in Bebas Neue, with the Question's end labels under them. */
export function RatingScale({
  question,
  labelledBy,
  value,
  onSelect,
}: ChoiceProps & { value: number | undefined; onSelect: (rating: number) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-5 gap-2">
        {RATING_VALUES.map((rating) => {
          const on = rating === value;
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(rating)}
              className={cn(
                "h-[76px] rounded-2xl font-[family-name:var(--font-bebas)] text-[38px] leading-none tracking-[0.02em] transition-colors",
                on
                  ? "-translate-y-[3px] border border-brand-lime bg-brand-lime text-forest shadow-[0_10px_18px_-10px_rgb(0_0_0/0.55)]"
                  : cn(RAISED_TARGET, SHEET_TEXT),
              )}
            >
              {rating}
            </button>
          );
        })}
      </div>
      <div className={cn("mt-2.5 flex justify-between text-[13px]", FAINT_TEXT)}>
        <span>{question.lowLabel}</span>
        <span>{question.highLabel}</span>
      </div>
    </div>
  );
}

/** Free text with a character count, and a line that says an optional Question may be skipped. */
export function FreeText({
  labelledBy,
  value,
  optional,
  onChange,
}: {
  labelledBy: string;
  value: string;
  optional: boolean;
  onChange: (text: string) => void;
}) {
  return (
    <div>
      <Textarea
        aria-labelledby={labelledBy}
        value={value}
        maxLength={SURVEY_LIMITS.textAnswerMax}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "max-h-[40svh] min-h-[168px] resize-none rounded-2xl border-brand-lime/50 bg-forest-light px-4 py-3.5 text-[17px] leading-[1.55] shadow-none md:text-[17px]",
          SHEET_TEXT,
        )}
      />
      <div className={cn("mt-2 flex text-xs tabular-nums", FAINT_TEXT)}>
        {optional && <span>אפשר גם לשלוח בלי לכתוב</span>}
        <span className="ms-auto" dir="ltr">
          {value.length}/{SURVEY_LIMITS.textAnswerMax}
        </span>
      </div>
    </div>
  );
}
