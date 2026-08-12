import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScheduleDayView } from "@/components/admin/schedule/ScheduleDayView";
import { getScheduleAction } from "@/lib/actions/daily-schedule";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getSessionSummariesAction } from "@/lib/actions/training-sessions";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "לוח יומי | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const params = await searchParams;
  const date =
    params.date && isValidDateString(params.date) ? params.date : israelToday();

  // Both roles edit slots, so both need the pick-lists that feed the slot form
  // (a trainer cannot read trainee rows through RLS, hence the dedicated
  // action). Session summaries feed the per-trainee built/not-built
  // indicators. isAdmin now gates only whole-day duplication.
  const [scheduleResult, summariesResult, optionsResult] = await Promise.all([
    getScheduleAction(date),
    getSessionSummariesAction(date),
    getSlotFormOptionsAction(),
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

  return (
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
    />
  );
}
