import { MessageSquareText, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { PersonRow, ReportSegment, SurveyReport } from "../../lib/report";
import { clampPage, pageSlice } from "../../lib/results-view";
import type { SurveyQuestion } from "../../lib/types";
import { AnswerGrid } from "./AnswerGrid";
import { PeopleList } from "./PeopleList";
import { ResultsPager } from "./ResultsPager";

interface ResultsBodyProps {
  report: SurveyReport;
  questions: readonly SurveyQuestion[];
  segment: ReportSegment;
  /** The 1-based page the address asks for; a page past the end shows the last one. */
  page: number;
}

const NOBODY = <EmptyState icon={Users} title="אין כאן אף אחד" />;

function AnsweredBody({ report, questions, page }: Omit<ResultsBodyProps, "segment">) {
  if (report.totals.answered === 0) {
    return <EmptyState icon={MessageSquareText} title="עוד אף אחד לא ענה" />;
  }
  // Answers exist, but the name search matched none of them.
  if (report.rowCount === 0) return NOBODY;
  return (
    <AnswerGrid
      questions={questions}
      summaries={report.questions}
      rows={report.rows}
      answeredTotal={report.totals.answered}
      rowCount={report.rowCount}
      page={clampPage(page, report.rowCount)}
    />
  );
}

function PeopleBody({ rows, showSeenDate, page }: { rows: readonly PersonRow[]; showSeenDate: boolean; page: number }) {
  if (rows.length === 0) return NOBODY;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <PeopleList rows={pageSlice(rows, page)} showSeenDate={showSeenDate} />
      <ResultsPager total={rows.length} page={clampPage(page, rows.length)} />
    </div>
  );
}

/** The part of the page the segmented control switches: the grid, or one of the two lists. */
export function ResultsBody({ report, questions, segment, page }: ResultsBodyProps) {
  if (segment === "answered") return <AnsweredBody report={report} questions={questions} page={page} />;
  const showSeenDate = segment === "seen";
  return (
    <PeopleBody
      rows={showSeenDate ? report.seenNotAnswered : report.unseen}
      showSeenDate={showSeenDate}
      page={page}
    />
  );
}
