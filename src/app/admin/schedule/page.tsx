import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScheduleDayView } from "@/components/admin/schedule/ScheduleDayView";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { getScheduleAction } from "@/lib/actions/daily-schedule";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getSessionSummariesAction } from "@/lib/actions/training-sessions";
import { getOnDutyAction } from "@/lib/actions/weekly-schedule";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "לוח יומי | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string; branch?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const params = await searchParams;
  const date =
    params.date && isValidDateString(params.date) ? params.date : israelToday();

  // The branch on screen: a valid in-scope ?branch= wins, anything else falls
  // back to the first branch the caller may see, as a bad ?date= does.
  const [scopeResult, branchOptions] = await Promise.all([
    getBranchScopeAction(),
    listActiveBranchOptionsAction(),
  ]);
  if ("error" in scopeResult) redirect("/dashboard");
  const scope = scopeResult.data.scope;
  const branches = allowedBranches(scope, branchOptions);
  const branchId = resolveRequestedBranch({
    requested: params.branch,
    scope,
    branches: branchOptions,
  });

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          אין סניפים פעילים לתצוגה
        </CardContent>
      </Card>
    );
  }

  // Both roles edit slots, so both need the pick-lists that feed the slot form
  // (a trainer cannot read trainee rows through RLS, hence the dedicated
  // action). Session summaries feed the per-trainee built/not-built
  // indicators. isAdmin now gates only whole-day duplication.
  const [scheduleResult, summariesResult, optionsResult, onDutyResult] =
    await Promise.all([
      getScheduleAction(date, branchId),
      getSessionSummariesAction(date),
      getSlotFormOptionsAction(branchId),
      getOnDutyAction(date, branchId),
    ]);

  // A load error must not render as an empty day: "אין לוח" invites the admin
  // to rebuild or duplicate onto a day that actually has slots.
  const loadError = "error" in scheduleResult ? scheduleResult.error : null;
  const slots = "success" in scheduleResult ? scheduleResult.data : [];
  // A summaries failure only hides the built/not-built badges — not worth
  // failing the whole page over.
  const sessionSummaries =
    "success" in summariesResult ? summariesResult.data : {};
  const options =
    "success" in optionsResult
      ? optionsResult.data
      : { trainers: [], trainees: [] };
  // Null on failure rather than an empty day: the strip and the build button
  // hide, instead of asserting that nobody is scheduled.
  const onDuty = "success" in onDutyResult ? onDutyResult.data : null;

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <ScheduleDayView
      date={date}
      today={israelToday()}
      slots={slots}
      sessionSummaries={sessionSummaries}
      loadError={loadError}
      isAdmin={isAdmin}
      currentUserId={user!.id}
      trainers={options.trainers}
      trainees={options.trainees}
      onDuty={onDuty}
      />
    </BranchProvider>
  );
}
