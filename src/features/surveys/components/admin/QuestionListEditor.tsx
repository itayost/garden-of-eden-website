"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { moveItem } from "../../lib/draft";
import { newEditorQuestion, type EditorQuestion } from "../../lib/editor-model";
import { SURVEY_LIMITS, type QuestionKind } from "../../lib/types";
import { KIND_META, KIND_ORDER } from "./kind-meta";
import { QuestionEditor } from "./QuestionEditor";

interface QuestionListEditorProps {
  questions: readonly EditorQuestion[];
  showProblems: boolean;
  onChange: (next: EditorQuestion[]) => void;
}

function AddQuestionRow({ atLimit, onAdd }: { atLimit: boolean; onAdd: (kind: QuestionKind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-dashed bg-muted/40 px-4 py-3.5 lg:px-[18px]">
      <span className="me-1.5 text-[13px] font-semibold">הוספת שאלה</span>
      {KIND_ORDER.map((kind) => {
        const { Icon, label } = KIND_META[kind];
        return (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit}
            onClick={() => onAdd(kind)}
          >
            <Icon aria-hidden="true" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * The Questions in order, each with its own move and delete, and a row to add
 * one of each kind. On a phone only one Question is open at a time: adding
 * one opens it and the text field takes focus.
 */
export function QuestionListEditor({ questions, showProblems, onChange }: QuestionListEditorProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const atLimit = questions.length >= SURVEY_LIMITS.questionsMax;

  const add = (kind: QuestionKind) => {
    const question = newEditorQuestion(kind);
    setOpenKey(question.key);
    setAddedKey(question.key);
    onChange([...questions, question]);
  };
  const replace = (next: EditorQuestion) =>
    onChange(questions.map((question) => (question.key === next.key ? next : question)));
  const remove = (key: string) => {
    if (openKey === key) setOpenKey(null);
    onChange(questions.filter((question) => question.key !== key));
  };

  return (
    <section aria-labelledby="questions-heading" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3.5 lg:px-[18px]">
        <h2 id="questions-heading" className="text-[15px] font-bold">
          שאלות <span className="font-normal text-muted-foreground">({questions.length})</span>
        </h2>
        <span className="text-xs text-muted-foreground">עד {SURVEY_LIMITS.questionsMax} שאלות</span>
      </div>
      {questions.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">עוד אין שאלות</p>
      )}
      <ol>
        {questions.map((question, index) => (
          <QuestionEditor
            key={question.key}
            question={question}
            number={index + 1}
            count={questions.length}
            open={openKey === question.key}
            showProblems={showProblems}
            autoFocusText={question.key === addedKey}
            onToggle={() => setOpenKey(openKey === question.key ? null : question.key)}
            onChange={replace}
            onMove={(direction) => onChange(moveItem(questions, index, index + direction))}
            onRemove={() => remove(question.key)}
          />
        ))}
      </ol>
      <AddQuestionRow atLimit={atLimit} onAdd={add} />
    </section>
  );
}
