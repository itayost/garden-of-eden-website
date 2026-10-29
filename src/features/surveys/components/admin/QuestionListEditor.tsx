"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { moveItem } from "../../lib/draft";
import { newEditorQuestion, type EditorQuestion } from "../../lib/editor-model";
import { ADD_QUESTION_FOCUS, focusAfterMove, focusAfterRemove } from "../../lib/focus-targets";
import { SURVEY_LIMITS, type QuestionKind } from "../../lib/types";
import { KIND_META, KIND_ORDER } from "./kind-meta";
import { QuestionEditor } from "./QuestionEditor";
import { useFocusRestore } from "./useFocusRestore";

interface QuestionListEditorProps {
  questions: readonly EditorQuestion[];
  showProblems: boolean;
  onChange: (next: EditorQuestion[]) => void;
}

function AddQuestionRow({ atLimit, onAdd }: { atLimit: boolean; onAdd: (kind: QuestionKind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-dashed bg-muted/40 px-4 py-3.5 lg:px-[18px]">
      <span className="me-1.5 text-[13px] font-semibold">הוספת שאלה</span>
      {KIND_ORDER.map((kind, index) => {
        const { Icon, label } = KIND_META[kind];
        return (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit}
            // Where focus lands when the last Question is deleted.
            data-focus-id={index === 0 ? ADD_QUESTION_FOCUS : undefined}
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

function QuestionListHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3.5 lg:px-[18px]">
      <h2 id="questions-heading" className="text-[15px] font-bold">
        שאלות <span className="font-normal text-muted-foreground">({count})</span>
      </h2>
      <span className="text-xs text-muted-foreground">עד {SURVEY_LIMITS.questionsMax} שאלות</span>
    </div>
  );
}

/**
 * Which Question is open and which was just added, and the edits to the list.
 * After a move or a delete, keyboard focus goes back to a control that is still
 * there (see focus-targets).
 */
function useQuestionList(questions: readonly EditorQuestion[], onChange: (next: EditorQuestion[]) => void) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const { listRef, restoreFocus } = useFocusRestore<HTMLElement>();

  const add = (kind: QuestionKind) => {
    const question = newEditorQuestion(kind);
    setOpenKey(question.key);
    setAddedKey(question.key);
    onChange([...questions, question]);
  };
  const replace = (next: EditorQuestion) =>
    onChange(questions.map((question) => (question.key === next.key ? next : question)));
  const move = (index: number, direction: -1 | 1) => {
    restoreFocus(focusAfterMove(questions[index].key, direction, index + direction, questions.length));
    onChange(moveItem(questions, index, index + direction));
  };
  const remove = (index: number) => {
    if (openKey === questions[index].key) setOpenKey(null);
    const keys = questions.map((question) => question.key);
    // A folded row on a phone cannot take focus on its delete button; its summary row can.
    restoreFocus(focusAfterRemove(keys, index, ["remove", "summary"], ADD_QUESTION_FOCUS));
    onChange(questions.filter((_, position) => position !== index));
  };
  const toggle = (key: string) => setOpenKey(openKey === key ? null : key);

  return { listRef, openKey, addedKey, add, replace, move, remove, toggle };
}

/**
 * The Questions in order, each with its own move and delete, and a row to add
 * one of each kind. On a phone only one Question is open at a time: adding
 * one opens it and the text field takes focus.
 */
export function QuestionListEditor({ questions, showProblems, onChange }: QuestionListEditorProps) {
  const { listRef, openKey, addedKey, add, replace, move, remove, toggle } = useQuestionList(questions, onChange);
  const atLimit = questions.length >= SURVEY_LIMITS.questionsMax;

  return (
    <section
      ref={listRef}
      aria-labelledby="questions-heading"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <QuestionListHeader count={questions.length} />
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
            onToggle={() => toggle(question.key)}
            onChange={replace}
            onMove={(direction) => move(index, direction)}
            onRemove={() => remove(index)}
          />
        ))}
      </ol>
      <AddQuestionRow atLimit={atLimit} onAdd={add} />
    </section>
  );
}
