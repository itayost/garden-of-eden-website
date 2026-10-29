"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { isChoiceKind } from "../../lib/draft";
import { withKind, type EditorQuestion } from "../../lib/editor-model";
import { focusId } from "../../lib/focus-targets";
import { SURVEY_LIMITS } from "../../lib/types";
import { KIND_META, KIND_ORDER, toQuestionKind } from "./kind-meta";
import { OptionListEditor } from "./OptionListEditor";
import { RatingEndsEditor } from "./RatingEndsEditor";
import { ToolButton } from "./ToolButton";

interface QuestionEditorProps {
  question: EditorQuestion;
  /** 1-based, as the Trainee will count it. */
  number: number;
  count: number;
  /** On a phone only one Question is open; from lg every Question is. */
  open: boolean;
  showProblems: boolean;
  autoFocusText: boolean;
  onToggle: () => void;
  onChange: (next: EditorQuestion) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * Move up, move down and delete. On a phone they sit at the end of the last
 * row; from lg they share the first row with the text and the kind. The grid
 * places them (row and column starts), so the element can come right after the
 * kind in the DOM and the tab order matches where it is drawn at lg.
 */
function QuestionTools({
  questionKey,
  number,
  count,
  onMove,
  onRemove,
}: Pick<QuestionEditorProps, "number" | "count" | "onMove" | "onRemove"> & { questionKey: string }) {
  return (
    <div className="col-start-2 row-start-4 flex lg:col-start-3 lg:row-start-1">
      <ToolButton
        label={`הזזת שאלה ${number} למעלה`}
        focusId={focusId(questionKey, "up")}
        disabled={number === 1}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </ToolButton>
      <ToolButton
        label={`הזזת שאלה ${number} למטה`}
        focusId={focusId(questionKey, "down")}
        disabled={number === count}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </ToolButton>
      <ToolButton
        destructive
        label={`מחיקת שאלה ${number}`}
        focusId={focusId(questionKey, "remove")}
        onClick={onRemove}
      >
        <Trash2 />
      </ToolButton>
    </div>
  );
}

/** "חובה לענות": whether a Trainee must answer before moving on. */
function RequiredToggle({ question, onChange }: Pick<QuestionEditorProps, "question" | "onChange">) {
  const id = useId();
  return (
    <div className="col-start-1 row-start-4 flex items-center gap-2 lg:col-span-3 lg:row-start-3">
      <Switch
        id={id}
        checked={question.required}
        onCheckedChange={(required) => onChange({ ...question, required })}
      />
      <Label htmlFor={id}>חובה לענות</Label>
    </div>
  );
}

/** The phone's one-line row: number, kind, text and whether it is optional. Tapping it opens or folds the Question. */
function QuestionSummary({
  question,
  number,
  open,
  bodyId,
  onToggle,
}: Pick<QuestionEditorProps, "question" | "number" | "open" | "onToggle"> & { bodyId: string }) {
  const { Icon, label } = KIND_META[question.kind];
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      data-focus-id={focusId(question.key, "summary")}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring lg:hidden"
    >
      <span className="grid size-6 flex-none place-items-center rounded-[7px] bg-secondary text-xs font-bold text-secondary-foreground">
        {number}
      </span>
      <Icon aria-hidden="true" className="size-[15px] flex-none text-muted-foreground" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block truncate">{question.text.trim() === "" ? "שאלה בלי טקסט" : question.text}</span>
        <span className="block text-xs text-muted-foreground">
          {label}
          {question.required ? "" : " · לא חובה"}
        </span>
      </span>
      <ChevronDown
        aria-hidden="true"
        className={cn("size-4 flex-none text-muted-foreground transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

function KindSelect({
  question,
  number,
  onChange,
}: Pick<QuestionEditorProps, "question" | "number" | "onChange">) {
  return (
    <Select
      value={question.kind}
      onValueChange={(value) => {
        const kind = toQuestionKind(value);
        if (kind !== null && kind !== question.kind) onChange(withKind(question, kind));
      }}
    >
      <SelectTrigger aria-label={`סוג שאלה ${number}`} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KIND_ORDER.map((kind) => {
          const { Icon, label } = KIND_META[kind];
          return (
            <SelectItem key={kind} value={kind}>
              <Icon aria-hidden="true" />
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function QuestionBody({
  question,
  number,
  showProblems,
  onChange,
}: Pick<QuestionEditorProps, "question" | "number" | "showProblems" | "onChange">) {
  if (isChoiceKind(question.kind)) {
    return (
      <OptionListEditor
        questionNumber={number}
        options={question.options}
        multi={question.kind === "multi_choice"}
        showProblems={showProblems}
        onChange={(options) => onChange({ ...question, options })}
      />
    );
  }
  if (question.kind === "rating") {
    return (
      <RatingEndsEditor
        questionNumber={number}
        lowLabel={question.lowLabel}
        highLabel={question.highLabel}
        onChange={(labels) => onChange({ ...question, ...labels })}
      />
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      החניך כותב עד {SURVEY_LIMITS.textAnswerMax} תווים
    </p>
  );
}

type QuestionFieldsProps = Omit<QuestionEditorProps, "open" | "onToggle">;

/**
 * The fields of one Question in a grid: a phone stacks them (text, kind, the
 * answers, then the required switch with the tools); lg draws the text, kind
 * and tools on one line. Rows and columns are set explicitly, so the DOM order
 * (text, kind, tools, answers, required) is the tab order at lg whatever a
 * phone draws.
 */
function QuestionFields(props: QuestionFieldsProps) {
  const { question, number, count, showProblems, autoFocusText, onChange, onMove, onRemove } = props;
  const textBlank = showProblems && question.text.trim() === "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 lg:grid-cols-[minmax(0,1fr)_11rem_auto]">
      <Input
        value={question.text}
        maxLength={SURVEY_LIMITS.questionTextMax}
        placeholder="מה רוצים לשאול?"
        aria-label={`טקסט שאלה ${number}`}
        aria-invalid={textBlank || undefined}
        autoFocus={autoFocusText}
        className="col-span-2 row-start-1 lg:col-span-1 lg:col-start-1"
        onChange={(event) => onChange({ ...question, text: event.target.value })}
      />
      <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <KindSelect question={question} number={number} onChange={onChange} />
      </div>
      <QuestionTools questionKey={question.key} number={number} count={count} onMove={onMove} onRemove={onRemove} />
      <div className="col-span-2 row-start-3 lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <QuestionBody question={question} number={number} showProblems={showProblems} onChange={onChange} />
      </div>
      <RequiredToggle question={question} onChange={onChange} />
    </div>
  );
}

/**
 * One Question as a block: on lg the number sits at the start and the text,
 * kind and tools share a line; on a phone the block is a summary row that
 * opens into the same fields, stacked.
 */
export function QuestionEditor({ open, onToggle, ...fields }: QuestionEditorProps) {
  const { question, number } = fields;
  // DOM ids come from useId, which agrees between the server render and the
  // client; the question's key is random per render pass and is only a React key.
  const bodyId = `question-body-${useId()}`;

  return (
    <li className="border-t first:border-t-0 focus-within:bg-secondary/30">
      <QuestionSummary question={question} number={number} open={open} bodyId={bodyId} onToggle={onToggle} />
      <div
        id={bodyId}
        className={cn(open ? "block" : "hidden", "px-4 pb-4 lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)] lg:gap-x-3 lg:p-[18px]")}
      >
        <span
          aria-hidden="true"
          className="mt-1 hidden size-7 place-items-center rounded-lg bg-secondary text-[13px] font-bold text-secondary-foreground lg:grid"
        >
          {number}
        </span>
        <QuestionFields {...fields} />
      </div>
    </li>
  );
}
