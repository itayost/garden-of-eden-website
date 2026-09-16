import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SessionWorklist } from "@/components/admin/schedule/SessionWorklist";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadPlanStatusesForStaff } from "@/features/plans/lib/actions/staff-plan-badges";
import { getScheduleAction } from "@/lib/actions/daily-schedule";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { getSessionSummariesAction } from "@/lib/actions/training-sessions";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { buildSessionWorklist } from "@/lib/schedule/session-worklist";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "בניית אימונים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string; branch?: string; mine?: string; pending?: string }>;
}

export default async function SessionWorklistPage({ searchParams }: PageProps) {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const today = israelToday();
  const params = await searchParams;
  const date = params.date && isValidDateString(params.date) ? params.date : today;

  const [scopeResult, branchOptions] = await Promise.all([
    getBranchScopeAction(),
    listActiveBranchOptionsAction(),
  ]);
  if ("error" in scopeResult) redirect("/dashboard");
  const scope = scopeResult.data.scope;
  const branches = allowedBranches(scope, branchOptions);
  const branchId = resolveRequestedBranch({ requested: params.branch, scope, branches: branchOptions });

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">אין סניפים פעילים לתצוגה</CardContent>
      </Card>
    );
  }

  const [scheduleResult, summariesResult] = await Promise.all([
    getScheduleAction(date, branchId),
    getSessionSummariesAction(date),
  ]);

  const loadError = "error" in scheduleResult ? scheduleResult.error : null;
  const slots = "success" in scheduleResult ? scheduleResult.data : [];
  const summariesFailed = "error" in summariesResult;
  const summaries = "success" in summariesResult ? summariesResult.data : {};

  const groups = buildSessionWorklist(slots, summaries);
  const traineeIds = Array.from(new Set(groups.flatMap((group) => group.rows.map((row) => row.traineeId))));
  const planBadges = await loadPlanStatusesForStaff(traineeIds);

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <SessionWorklist
        date={date}
        today={today}
        groups={groups}
        planBadges={planBadges}
        loadError={loadError}
        summariesFailed={summariesFailed}
        currentUserId={user!.id}
        isAdmin={profile!.role === "admin"}
        mineOnly={params.mine === "1"}
        pendingOnly={params.pending === "1"}
      />
    </BranchProvider>
  );
}
