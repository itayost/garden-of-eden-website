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
  /** A branch or birth-year filter is on, so an empty slice is not "nobody answered". */
  narrowed: boolean;
}

const NOBODY = <EmptyState icon={Users} title="אין כאן אף אחד" />;

function AnsweredBody({ report, questions, page, narrowed }: Omit<ResultsBodyProps, "segment">) {
  if (report.totals.answered === 0) {
    // Inside a branch or birth-year slice, the Survey may well have answers elsewhere.
    return narrowed ? NOBODY : <EmptyState icon={MessageSquareText} title="עוד אף אחד לא ענה" />;
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
export function ResultsBody({ report, questions, segment, page, narrowed }: ResultsBodyProps) {
  if (segment === "answered") {
    return <AnsweredBody report={report} questions={questions} page={page} narrowed={narrowed} />;
  }
  const showSeenDate = segment === "seen";
  return (
    <PeopleBody
      rows={showSeenDate ? report.seenNotAnswered : report.unseen}
      showSeenDate={showSeenDate}
      page={page}
    />
  );
}
