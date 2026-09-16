import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WeeklySchedulePageClient } from "@/components/admin/schedule/week/WeeklySchedulePageClient";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getWeeklyScheduleAction } from "@/lib/actions/weekly-schedule";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";

export const metadata: Metadata = {
  title: "לוח שבועי | Garden of Eden",
};

/** How far ahead the exceptions list looks. Beyond this is not yet planned. */
const EXCEPTION_WINDOW_DAYS = 60;

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

export default async function WeeklySchedulePage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();
  const params = await searchParams;

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

  // The exceptions panel is anchored to today so it answers "what is coming
  // up". A week back so an exception written for yesterday does not vanish the
  // moment it takes effect.
  const panelFromDate = addDays(today, -7);
  const panelToDate = addDays(today, EXCEPTION_WINDOW_DAYS);

  // Trainers read this page too, so the pick-list must come from the
  // admin-client action: under a trainer session the shared helper silently
  // drops admins who coach. Only admins can act on all of it, but a list that
  // is quietly missing people is worse than one they cannot use.
  const [templateResult, optionsResult] = await Promise.all([
    getWeeklyScheduleAction(panelFromDate, panelToDate, branchId),
    getSlotFormOptionsAction(branchId),
  ]);

  const templateError = "error" in templateResult ? templateResult.error : null;
  const bands = "success" in templateResult ? templateResult.data.bands : [];
  const panelExceptions =
    "success" in templateResult ? templateResult.data.exceptions : [];
  const options =
    "success" in optionsResult
      ? optionsResult.data
      : { trainers: [], trainees: [] };

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <WeeklySchedulePageClient
        bands={bands}
        exceptions={panelExceptions}
        panelFromDate={panelFromDate}
        panelToDate={panelToDate}
        isAdmin={isAdmin}
        trainers={options.trainers}
        templateError={templateError}
      />
    </BranchProvider>
  );
}
