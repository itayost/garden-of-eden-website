"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { moveItem } from "../../lib/draft";
import { blankOption, type EditorOption } from "../../lib/editor-model";
import { SURVEY_LIMITS } from "../../lib/types";
import { ToolButton } from "./ToolButton";

interface OptionToolsProps {
  /** The option's 1-based number and the Question it is in ("בשאלה 3"), so each button says what it moves. */
  number: number;
  where: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function OptionTools({ number, where, isFirst, isLast, onMove, onRemove }: OptionToolsProps) {
  return (
    <div className="flex">
      <ToolButton compact label={`הזזת תשובה ${number} למעלה ${where}`} disabled={isFirst} onClick={() => onMove(-1)}>
        <ArrowUp />
      </ToolButton>
      <ToolButton compact label={`הזזת תשובה ${number} למטה ${where}`} disabled={isLast} onClick={() => onMove(1)}>
        <ArrowDown />
      </ToolButton>
      <ToolButton compact label={`מחיקת תשובה ${number} ${where}`} onClick={onRemove}>
        <X />
      </ToolButton>
    </div>
  );
}

interface OptionRowProps {
  option: EditorOption;
  index: number;
  count: number;
  /** "בשאלה 3": which Question the row is in. */
  where: string;
  multi: boolean;
  blank: boolean;
  autoFocus: boolean;
  onEdit: (label: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function OptionRow({ option, index, count, where, multi, blank, autoFocus, onEdit, onMove, onRemove }: OptionRowProps) {
  const number = index + 1;
  return (
    <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cn("mt-2.5 size-4 border-[1.5px] border-border", multi ? "rounded-[4px]" : "rounded-full")}
      />
      <div className="min-w-0">
        <Input
          value={option.label}
          maxLength={SURVEY_LIMITS.optionMax}
          placeholder={`תשובה ${number}`}
          aria-label={`תשובה ${number} ${where}`}
          aria-invalid={blank || undefined}
          autoFocus={autoFocus}
          onChange={(event) => onEdit(event.target.value)}
        />
        {blank && (
          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            צריך למלא את התשובה או למחוק אותה
          </p>
        )}
      </div>
      <OptionTools
        number={number}
        where={where}
        isFirst={index === 0}
        isLast={index === count - 1}
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

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

/** A Question's answers: type, add, remove and move them. Keys, not indexes, keep each row's identity. */
export function OptionListEditor({ questionNumber, options, multi, showProblems, onChange }: OptionListEditorProps) {
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const add = () => {
    const option = blankOption();
    setAddedKey(option.key);
    onChange([...options, option]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option, index) => (
        <OptionRow
          key={option.key}
          option={option}
          index={index}
          count={options.length}
          where={`בשאלה ${questionNumber}`}
          multi={multi}
          blank={showProblems && option.label.trim() === ""}
          autoFocus={option.key === addedKey}
          onEdit={(label) => onChange(options.map((o) => (o.key === option.key ? { ...o, label } : o)))}
          onMove={(direction) => onChange(moveItem(options, index, index + direction))}
          onRemove={() => onChange(options.filter((o) => o.key !== option.key))}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-primary"
        disabled={options.length >= SURVEY_LIMITS.optionsMax}
        onClick={add}
      >
        <Plus aria-hidden="true" />
        הוספת תשובה
      </Button>
    </div>
  );
}
