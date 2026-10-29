import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { GridRow, QuestionSummary } from "../../lib/report";
import { sentAtText } from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";
import { AnswerCell } from "./AnswerCell";
import { KIND_META } from "./kind-meta";
import { PersonBlock } from "./PersonBlock";
import { QuestionChip } from "./QuestionChip";
import { SummaryCell } from "./SummaryCell";

/**
 * Cells carry their own bottom border: the table is `border-separate` so the
 * pinned column can stick, and a separated table draws no row borders.
 */
const CELL = "border-b px-3 py-2.5 align-top whitespace-normal";
const PINNED = "sticky start-0 z-10 min-w-[190px] border-e bg-card group-hover:bg-muted";
const QUESTION_COLUMN = "min-w-[150px] max-w-[220px]";

interface GridTableProps {
  questions: readonly SurveyQuestion[];
  summaries: ReadonlyMap<string, QuestionSummary>;
  rows: readonly GridRow[];
  /** How many Responses the summary row sums up. */
  answeredTotal: number;
  onOpenQuestion: (questionId: string) => void;
  onOpenRow: (row: GridRow) => void;
}

function QuestionHeader({
  question,
  number,
  onOpen,
}: {
  question: SurveyQuestion;
  number: number;
  onOpen: () => void;
}) {
  const { Icon, label } = KIND_META[question.kind];
  return (
    <TableHead className={cn(CELL, QUESTION_COLUMN, "h-auto align-bottom")}>
      <button
        type="button"
        onClick={onOpen}
        className="group/question block w-full rounded-md text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <QuestionChip number={number} />
        <span className="mt-1.5 block font-semibold leading-snug group-hover/question:underline">
          {question.text}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Icon aria-hidden="true" className="size-3" />
          {label}
        </span>
        <span className="sr-only">, לתוצאות המלאות של השאלה</span>
      </button>
    </TableHead>
  );
}

function SummaryRow({
  questions,
  summaries,
  answeredTotal,
}: Pick<GridTableProps, "questions" | "summaries" | "answeredTotal">) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className={cn(CELL, PINNED, "bg-muted align-bottom")}>
        <b>סיכום</b>
        <span className="block text-xs text-muted-foreground">כל {answeredTotal} העונים</span>
      </TableCell>
      {questions.map((question) => {
        const summary = summaries.get(question.id);
        return (
          <TableCell key={question.id} className={cn(CELL, "bg-muted align-bottom")}>
            {summary !== undefined && <SummaryCell summary={summary} />}
          </TableCell>
        );
      })}
      <TableCell className={cn(CELL, "bg-muted")} />
    </TableRow>
  );
}

function ResponseRow({
  row,
  questions,
  onOpen,
}: {
  row: GridRow;
  questions: readonly SurveyQuestion[];
  onOpen: () => void;
}) {
  const cell = cn(CELL, "group-hover:bg-muted");
  return (
    // The name is the keyboard stop; its click bubbles up to the row.
    <TableRow className="group cursor-pointer hover:bg-transparent" onClick={onOpen}>
      <TableCell className={cn(CELL, PINNED)}>
        <button
          type="button"
          className="block w-full rounded-md text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <PersonBlock fullName={row.fullName} branchNames={row.branchNames} birthYear={row.birthYear} />
          <span className="sr-only">, לתשובות המלאות</span>
        </button>
      </TableCell>
      {questions.map((question) => (
        <TableCell key={question.id} className={cell}>
          <AnswerCell kind={question.kind} cell={row.answers[question.id]} clamp />
        </TableCell>
      ))}
      <TableCell className={cn(cell, "text-xs tabular-nums whitespace-nowrap text-muted-foreground")}>
        {sentAtText(row.submittedAt)}
      </TableCell>
    </TableRow>
  );
}

/** The desktop grid: the Trainee column pinned, a column per Question, the summary row first. */
export function GridTable({ questions, summaries, rows, answeredTotal, onOpenQuestion, onOpenRow }: GridTableProps) {
  return (
    <Table className="border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(CELL, PINNED, "h-auto align-bottom")}>חניך</TableHead>
          {questions.map((question, index) => (
            <QuestionHeader
              key={question.id}
              question={question}
              number={index + 1}
              onOpen={() => onOpenQuestion(question.id)}
            />
          ))}
          <TableHead className={cn(CELL, "h-auto align-bottom")}>נשלח</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&_tr:last-child_td]:border-b-0">
        <SummaryRow questions={questions} summaries={summaries} answeredTotal={answeredTotal} />
        {rows.map((row) => (
          <ResponseRow key={row.profileId} row={row} questions={questions} onOpen={() => onOpenRow(row)} />
        ))}
      </TableBody>
    </Table>
  );
}
