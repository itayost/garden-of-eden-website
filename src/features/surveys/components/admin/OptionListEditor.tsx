"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { moveItem } from "../../lib/draft";
import { blankOption, type EditorOption } from "../../lib/editor-model";
import { SURVEY_LIMITS } from "../../lib/types";

interface OptionListEditorProps {
  /** The Question's number, so each control says which Question it belongs to. */
  questionNumber: number;
  options: readonly EditorOption[];
  /** Checkbox marks for several answers, radio marks for one. */
  multi: boolean;
  /** Outlines a blank option once the person has tried to publish. */
  showProblems: boolean;
  onChange: (next: EditorOption[]) => void;
}

const TOOL = "size-7 text-muted-foreground";

/** A Question's answers: type, add, remove and move them. Keys, not indexes, keep each row's identity. */
export function OptionListEditor({
  questionNumber,
  options,
  multi,
  showProblems,
  onChange,
}: OptionListEditorProps) {
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const atLimit = options.length >= SURVEY_LIMITS.optionsMax;
  const where = `בשאלה ${questionNumber}`;

  const edit = (key: string, label: string) =>
    onChange(options.map((option) => (option.key === key ? { ...option, label } : option)));
  const remove = (key: string) => onChange(options.filter((option) => option.key !== key));
  const move = (from: number, to: number) => onChange(moveItem(options, from, to));
  const add = () => {
    const option = blankOption();
    setAddedKey(option.key);
    onChange([...options, option]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option, index) => {
        const blank = showProblems && option.label.trim() === "";
        return (
          <div key={option.key} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-2.5 size-4 border-[1.5px] border-border",
                multi ? "rounded-[4px]" : "rounded-full",
              )}
            />
            <div className="min-w-0">
              <Input
                value={option.label}
                maxLength={SURVEY_LIMITS.optionMax}
                placeholder={`תשובה ${index + 1}`}
                aria-label={`תשובה ${index + 1} ${where}`}
                aria-invalid={blank || undefined}
                autoFocus={option.key === addedKey}
                onChange={(event) => edit(option.key, event.target.value)}
              />
              {blank && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <TriangleAlert aria-hidden="true" className="size-3.5" />
                  צריך למלא את התשובה או למחוק אותה
                </p>
              )}
            </div>
            <div className="flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={TOOL}
                disabled={index === 0}
                aria-label={`הזזת תשובה ${index + 1} למעלה ${where}`}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={TOOL}
                disabled={index === options.length - 1}
                aria-label={`הזזת תשובה ${index + 1} למטה ${where}`}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={TOOL}
                aria-label={`מחיקת תשובה ${index + 1} ${where}`}
                onClick={() => remove(option.key)}
              >
                <X />
              </Button>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-primary"
        disabled={atLimit}
        onClick={add}
      >
        <Plus aria-hidden="true" />
        הוספת תשובה
      </Button>
    </div>
  );
}
