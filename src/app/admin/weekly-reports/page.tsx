import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isInBranchScope, type BranchScope } from "@/lib/branches/branch-scope";
import { allowedBranches } from "@/lib/branches/resolve-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsraelTime } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { listReportSettingsAction } from "@/features/weekly-reports/lib/actions/settings-load";
import { loadQueue, loadReportDetail, queueWeeks, type ReportDetail } from "@/features/weekly-reports/lib/queries/queue";
import {
  filterRows,
  nextReportId,
  pickFilter,
  pickWeek,
  queueHref,
  weekChoices,
  type QueueFilter,
} from "@/features/weekly-reports/lib/queue-view";
import { lastCompletedWeekStart, nextSendLabel, reportWeekLabel } from "@/features/weekly-reports/lib/report-week";
import { ApproveAllButton } from "@/features/weekly-reports/components/admin/ApproveAllButton";
import { QueueFilters } from "@/features/weekly-reports/components/admin/QueueFilters";
import { QueueList } from "@/features/weekly-reports/components/admin/QueueList";
import { ReportReader } from "@/features/weekly-reports/components/admin/ReportReader";
import { ReportSettingsCard } from "@/features/weekly-reports/components/admin/ReportSettingsCard";
import { WeekPicker } from "@/features/weekly-reports/components/admin/WeekPicker";
import { WeekStatus } from "@/features/weekly-reports/components/admin/WeekStatus";
import { ProposalQueue } from "@/features/goal-proposals/components/ProposalQueue";
import { loadOpenProposals } from "@/features/goal-proposals/lib/queries/views";

export const metadata: Metadata = { title: "דוחות שבועיים | Garden of Eden" };

/** כתוב מחדש and בן / בת call the model from a server action of this page. */
export const maxDuration = 120;

const EMPTY_TEXT: Record<QueueFilter, string> = {
  todo: "אין דוחות שמחכים לטיפול",
  approved: "אין דוחות מאושרים שמחכים לשליחה",
  sent: "עוד לא נשלחו דוחות השבוע",
  missed_you: "אין הודעות התגעגענו השבוע",
  absent: "אין חניכים שלא הגיעו 3 שבועות",
  proposals: "אין הצעות יעד פתוחות",
};

interface PageProps {
  searchParams: Promise<{ week?: string; branch?: string; tab?: string; report?: string }>;
}

/**
 * The report in ?report=, only when the caller may see it: its row is in a
 * branch of theirs and its Trainee is in their scope, the rule every action
 * checks again.
 */
async function visibleReport(id: string | undefined, scope: BranchScope): Promise<ReportDetail | null> {
  if (!id || !isValidUUID(id)) return null;
  const report = await loadReportDetail(createAdminClient(), id);
  // The absent list has no report: its rows link to the trainee page.
  if (report === null || report.kind === "absent" || !isInBranchScope(scope, report.branchIds)) return null;
  return (await assertTraineeInScope(report.traineeId)) === null ? report : null;
}

export default async function WeeklyReportsPage({ searchParams }: PageProps) {
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) redirect("/admin");
  const isAdmin = profile!.role === "admin";
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) redirect("/admin");
  const { scope } = scopeResult.data;

  const params = await searchParams;
  const db = createAdminClient();
  const current = lastCompletedWeekStart(israelToday());
  const week = pickWeek(params.week, current);
  const [allBranches, storedWeeks] = await Promise.all([listActiveBranchOptionsAction(), queueWeeks(db)]);
  const branches = allowedBranches(scope, allBranches);
  const branch = branches.some((b) => b.id === params.branch) ? params.branch : undefined;

  // A failed read throws on purpose: the admin error page, not an empty queue.
  const scopeBranchIds = scope.kind === "all" ? null : scope.ids;
  const [queue, proposals, report, settings] = await Promise.all([
    loadQueue(db, { weekStart: week, scopeBranchIds, filterBranchId: branch }),
    loadOpenProposals(db, { scopeBranchIds, filterBranchId: branch }),
    visibleReport(params.report, scope),
    isAdmin ? listReportSettingsAction() : Promise.resolve(null),
  ]);
  // The proposals are of every week, so they count in their filter only.
  const counts = { ...queue.counts, proposals: proposals.length };
  const filter = pickFilter(params.tab, counts);
  const rows = filterRows(queue.rows, filter);
  const approvable = rows.filter((row) => row.tab === "pending" && row.writtenAt !== null).length;
  const location = { week, branch, tab: filter };
  const at = report ? rows.findIndex((row) => row.id === report.id) : -1;
  const firstOpenable = rows.find((row) => row.kind !== "absent");

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold sm:text-3xl">דוחות שבועיים</h1>
          <p className="text-sm text-muted-foreground">שבוע {reportWeekLabel(week)}</p>
        </div>
        {settings && "success" in settings && <ReportSettingsCard settings={settings.data} />}
      </header>

      <WeekStatus counts={queue.counts} nextSend={nextSendLabel(getIsraelTime(new Date()))} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <WeekPicker weeks={weekChoices([...storedWeeks, week], current)} value={week} current={current} />
        {branches.length > 1 && <BranchUrlFilter branches={branches} className="w-full sm:w-48" />}
      </div>

      <QueueFilters active={filter} counts={counts} location={{ week, branch }} />

      {filter === "proposals" ? (
        <section className="space-y-4" aria-label="הצעות יעד">
          <p className="text-sm text-muted-foreground">הצעות פתוחות מכל המבדקים, לא לפי שבוע</p>
          <ProposalQueue proposals={proposals} emptyText={EMPTY_TEXT.proposals} />
        </section>
      ) : filter === "absent" ? (
        <QueueList rows={rows} location={location} selectedId={null} emptyText={EMPTY_TEXT.absent} />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="space-y-3">
            {filter === "todo" && approvable > 0 && <ApproveAllButton weekStart={week} branchId={branch} count={approvable} />}
            <QueueList rows={rows} location={location} selectedId={report?.id ?? null} emptyText={EMPTY_TEXT[filter]} />
          </div>
          {report ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-background lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:max-h-[calc(100dvh-2rem)] lg:rounded-xl lg:border lg:bg-card">
              <ReportReader
                key={`${report.id}:${report.version}`}
                report={report}
                location={location}
                nextId={nextReportId(rows, report.id)}
                position={at === -1 ? null : { index: at, total: rows.length }}
              />
            </div>
          ) : (
            <div className="hidden min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center lg:grid">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">בחרו דוח מהרשימה כדי לקרוא אותו כאן.</p>
                {firstOpenable && (
                  <Link
                    href={queueHref({ ...location, report: firstOpenable.id })}
                    replace
                    scroll={false}
                    className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    להתחיל מהראשון
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
