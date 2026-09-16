import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarView } from "@/components/admin/calendar/CalendarView";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadPlanStatusesForStaff } from "@/features/plans/lib/actions/staff-plan-badges";
import { getSlotsForWeekAction } from "@/lib/actions/daily-schedule";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { getExceptionsInRangeAction, getWeeklyScheduleAction } from "@/lib/actions/weekly-schedule";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { resolveCalendarDate } from "@/lib/schedule/calendar";
import { addDays } from "@/lib/utils/iso-date";
import { buildWeek, startOfWeek } from "@/lib/utils/schedule-week";
import { israelToday } from "@/lib/utils/tasks";

export const metadata: Metadata = {
  title: "יומן | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string; branch?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();
  const params = await searchParams;
  const date = resolveCalendarDate(params.date, today);
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

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

  // Trainers read this page too, so the pick-lists come from the admin-client
  // action (RLS hides trainee rows from a trainer).
  const [slotsResult, templateResult, exceptionsResult, optionsResult] = await Promise.all([
    getSlotsForWeekAction(weekStart, branchId),
    getWeeklyScheduleAction(weekStart, weekEnd, branchId),
    getExceptionsInRangeAction(weekStart, weekEnd, branchId),
    getSlotFormOptionsAction(branchId),
  ]);

  // Each failure degrades on its own and never renders as "nothing here".
  const slotsError = "error" in slotsResult ? slotsResult.error : null;
  const slots = "success" in slotsResult ? slotsResult.data : [];
  const templateFailed = "error" in templateResult || "error" in exceptionsResult;
  const bands = "success" in templateResult ? templateResult.data.bands : [];
  const exceptions = "success" in exceptionsResult ? exceptionsResult.data : [];
  const options = "success" in optionsResult ? optionsResult.data : { trainers: [], trainees: [] };

  const week = buildWeek({ weekStart, today, slots, bands, exceptions });

  const rosterIds = Array.from(
    new Set(slots.flatMap((slot) => slot.trainees.flatMap((t) => (t.trainee_id ? [t.trainee_id] : [])))),
  );
  const planBadges = await loadPlanStatusesForStaff(rosterIds);

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <CalendarView
        week={week}
        weekStart={weekStart}
        date={date}
        today={today}
        isAdmin={isAdmin}
        trainers={options.trainers}
        trainees={options.trainees}
        planBadges={planBadges}
        slotsError={slotsError}
        templateFailed={templateFailed}
      />
    </BranchProvider>
  );
}
