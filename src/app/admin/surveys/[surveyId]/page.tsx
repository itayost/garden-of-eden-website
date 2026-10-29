import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import { listBranchesAction } from "@/features/branches/lib/actions/list-branches";
import { requireSurveyStaff } from "@/features/surveys/lib/actions/staff-access";
import { surveyCsvRows } from "@/features/surveys/lib/csv";
import { audienceText } from "@/features/surveys/lib/format";
import {
  canDeleteSurvey,
  canEditSurvey,
  canViewSurvey,
  visibleSurveyBranches,
} from "@/features/surveys/lib/permissions";
import { loadAudienceCandidates, loadReportRows, loadSurvey, type LoadedSurvey } from "@/features/surveys/lib/queries";
import { buildSurveyReport, type ReportFilters, type SurveyReport } from "@/features/surveys/lib/report";
import { parseReportFilters } from "@/features/surveys/lib/report-filters";
import { clampPage, runDatesText, segmentCounts } from "@/features/surveys/lib/results-view";
import { audienceReportPeople } from "@/features/surveys/lib/rows";
import { surveyState } from "@/features/surveys/lib/state";
import type { SurveyState, SurveyViewer } from "@/features/surveys/lib/types";
import { PhoneSummaryList } from "@/features/surveys/components/admin/PhoneSummaryList";
import { ResultsBody } from "@/features/surveys/components/admin/ResultsBody";
import { ResultsToolbar } from "@/features/surveys/components/admin/ResultsToolbar";
import { SummaryStrip } from "@/features/surveys/components/admin/SummaryStrip";
import { SurveyActions } from "@/features/surveys/components/admin/SurveyActions";
import { SurveyResultsHeader } from "@/features/surveys/components/admin/SurveyResultsHeader";

export const metadata: Metadata = { title: "תוצאות סקר | Garden of Eden" };

interface PageProps {
  params: Promise<{ surveyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Db = ReturnType<typeof createAdminClient>;
type NamedBranch = { id: string; name: string };

/** The Survey's own branches by name, in the order the branches are kept. */
async function surveyBranches(branchIds: readonly string[]): Promise<NamedBranch[]> {
  const all = await listBranchesAction();
  return all
    .filter((branch) => branchIds.includes(branch.id))
    .map((branch) => ({ id: branch.id, name: branch.name_he }));
}

/**
 * Reads what the report is built from and builds it. A page past the last one
 * is built again for the last page, so an old link never shows an empty grid.
 * A failed read throws on purpose: the admin error page, not an empty report.
 */
async function buildReport(
  db: Db,
  survey: LoadedSurvey,
  branches: NamedBranch[],
  visibleBranchIds: string[] | null,
  filters: ReportFilters,
): Promise<SurveyReport> {
  const { record, questions } = survey;
  const [candidates, rows] = await Promise.all([
    loadAudienceCandidates(db, record.branchIds),
    loadReportRows(db, record.id),
  ]);
  const input = {
    questions,
    branches,
    responses: rows.responses,
    seen: rows.seen,
    audience: audienceReportPeople(candidates, record),
    visibleBranchIds,
    filters,
  };
  const report = buildSurveyReport(input);
  const page = clampPage(filters.page, report.rowCount);
  return page === filters.page ? report : buildSurveyReport({ ...input, filters: { ...filters, page } });
}

interface ResultsData {
  survey: LoadedSurvey;
  state: SurveyState;
  today: string;
  branches: NamedBranch[];
  visibleBranchIds: string[] | null;
  filters: ReportFilters;
  report: SurveyReport;
}

/** The checks, then everything the page shows. The redirects and the 404 are decided here. */
async function loadResultsData(
  viewer: SurveyViewer,
  surveyId: string,
  params: Awaited<PageProps["searchParams"]>,
): Promise<ResultsData> {
  if (!isValidUUID(surveyId)) notFound();
  const db = createAdminClient();
  const survey = await loadSurvey(db, surveyId);
  if (survey === null) notFound();
  const { record } = survey;
  if (!canViewSurvey(viewer.role, viewer.managedBranchIds, record.branchIds)) redirect("/admin/surveys");

  const today = israelToday();
  const state = surveyState(record, today);
  // A draft has no results; the builder owns it, with its delete and unpublish.
  if (state === "draft") redirect(`/admin/surveys/${record.id}/edit`);

  const visibleBranchIds = visibleSurveyBranches(viewer.role, viewer.managedBranchIds, record.branchIds);
  const filters = parseReportFilters(params, visibleBranchIds ?? record.branchIds);
  const branches = await surveyBranches(record.branchIds);
  const report = await buildReport(db, survey, branches, visibleBranchIds, filters);
  return { survey, state, today, branches, visibleBranchIds, filters, report };
}

/** What the viewer may do. The server actions refuse the rest; the page only hides it. */
function actionRights(viewer: SurveyViewer, { survey, state }: Pick<ResultsData, "survey" | "state">) {
  const { record, responseCount } = survey;
  const mayEdit = canEditSurvey(viewer.role, viewer.managedBranchIds, record.branchIds);
  return {
    // A Survey closed early takes no changes; the editor sends its viewer back here.
    canEdit: mayEdit && record.closedAt === null,
    canClose: mayEdit && state === "open",
    canDelete: canDeleteSurvey(viewer.role, viewer.managedBranchIds, record.branchIds, responseCount),
  };
}

function ResultsPageView({ viewer, data }: { viewer: SurveyViewer; data: ResultsData }) {
  const { survey, state, today, branches, visibleBranchIds, filters, report } = data;
  const { record, questions } = survey;
  const filterBranches = branches
    .filter((branch) => visibleBranchIds === null || visibleBranchIds.includes(branch.id))
    .map((branch) => ({ id: branch.id, nameHe: branch.name }));
  const actions = (
    <SurveyActions
      surveyId={record.id}
      {...actionRights(viewer, data)}
      responseCount={survey.responseCount}
      csvRows={surveyCsvRows(questions, report.allRows)}
      csvFileName={`survey-${today}.csv`}
    />
  );

  return (
    <div className="space-y-5">
      <SurveyResultsHeader
        title={record.title}
        state={state}
        audience={audienceText(branches.map((branch) => branch.name), record.birthYears)}
        dates={runDatesText(record, state, today)}
        actions={actions}
      />
      <SummaryStrip totals={report.totals} byBranch={report.byBranch} />
      {filters.segment === "answered" && report.totals.answered > 0 && (
        <PhoneSummaryList questions={questions} summaries={report.questions} />
      )}
      <ResultsToolbar counts={segmentCounts(report.totals)} branches={filterBranches} birthYears={report.birthYears} />
      <ResultsBody report={report} questions={questions} segment={filters.segment} page={filters.page} />
    </div>
  );
}

export default async function SurveyResultsPage({ params, searchParams }: PageProps) {
  // Admins and Branch managers; a manager reads only the Trainees of their branches.
  const access = await requireSurveyStaff();
  if ("error" in access) redirect("/admin");

  const { surveyId } = await params;
  const data = await loadResultsData(access.viewer, surveyId, await searchParams);
  return <ResultsPageView viewer={access.viewer} data={data} />;
}
