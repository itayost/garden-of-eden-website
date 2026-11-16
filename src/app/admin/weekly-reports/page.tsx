import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isInBranchScope, type BranchScope } from "@/lib/branches/branch-scope";
import { allowedBranches } from "@/lib/branches/resolve-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { listReportSettingsAction } from "@/features/weekly-reports/lib/actions/settings-load";
import { loadQueue, loadReportDetail, queueWeeks, type ReportDetail } from "@/features/weekly-reports/lib/queries/queue";
import { countsLine, pickTab, pickWeek, queueHref, weekChoices, type QueueTab } from "@/features/weekly-reports/lib/queue-view";
import { lastCompletedWeekStart, reportWeekLabel } from "@/features/weekly-reports/lib/report-week";
import { ApproveAllButton } from "@/features/weekly-reports/components/admin/ApproveAllButton";
import { QueueTable } from "@/features/weekly-reports/components/admin/QueueTable";
import { QueueTabs } from "@/features/weekly-reports/components/admin/QueueTabs";
import { ReportSettingsCard } from "@/features/weekly-reports/components/admin/ReportSettingsCard";
import { ReportSheet } from "@/features/weekly-reports/components/admin/ReportSheet";
import { WeekPicker } from "@/features/weekly-reports/components/admin/WeekPicker";

export const metadata: Metadata = { title: "דוחות שבועיים | Garden of Eden" };

/** כתוב מחדש and בן / בת call the model from a server action of this page. */
export const maxDuration = 120;

const EMPTY_TEXT: Record<QueueTab, string> = {
  held: "אין דוחות מעוכבים",
  pending: "אין דוחות שממתינים לאישור",
  approved: "אין דוחות מאושרים שמחכים לשליחה",
  sent: "עוד לא נשלחו דוחות השבוע",
  missed_you: "אין הודעות התגעגענו השבוע",
  absent: "אין חניכים שלא הגיעו 3 שבועות",
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
  // The absent list has no sheet: its rows link to the trainee page.
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
  const [queue, report, settings] = await Promise.all([
    loadQueue(db, { weekStart: week, scopeBranchIds: scope.kind === "all" ? null : scope.ids, filterBranchId: branch }),
    visibleReport(params.report, scope),
    isAdmin ? listReportSettingsAction() : Promise.resolve(null),
  ]);
  const tab = pickTab(params.tab, queue.counts);
  const rows = queue.rows.filter((row) => row.tab === tab);
  const approvable = rows.filter((row) => row.tab === "pending" && row.writtenAt !== null).length;
  const location = { week, branch, tab };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">דוחות שבועיים</h1>
        <p className="text-muted-foreground">שבוע {reportWeekLabel(week)}</p>
        <p className="text-sm">{countsLine(queue.counts)}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <WeekPicker weeks={weekChoices([...storedWeeks, week], current)} value={week} current={current} />
        {branches.length > 1 && <BranchUrlFilter branches={branches} className="w-full sm:w-48" />}
      </div>

      <QueueTabs active={tab} counts={queue.counts} location={{ week, branch }} />

      {tab === "pending" && <ApproveAllButton weekStart={week} branchId={branch} count={approvable} />}

      <QueueTable rows={rows} location={location} emptyText={EMPTY_TEXT[tab]} />

      {settings && "success" in settings && <ReportSettingsCard settings={settings.data} />}

      <ReportSheet report={report} closeHref={queueHref(location)} />
    </div>
  );
}
