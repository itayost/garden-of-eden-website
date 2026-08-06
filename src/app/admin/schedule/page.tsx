import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScheduleDayView } from "@/components/admin/schedule/ScheduleDayView";
import { getLinkableTraineesAction } from "@/lib/actions/admin-tasks";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import { getScheduleAction } from "@/lib/actions/daily-schedule";
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

  // Trainer and trainee rosters feed admin-only editing UI; a trainer reads
  // the schedule and never needs them. Session summaries feed the per-trainee
  // built/not-built indicators, which both roles see.
  const [scheduleResult, summariesResult, trainersResult, traineesResult] =
    await Promise.all([
      getScheduleAction(date),
      getSessionSummariesAction(date),
      isAdmin ? listTrainersForAssignmentAction() : null,
      isAdmin ? getLinkableTraineesAction() : null,
    ]);

  // A load error must not render as an empty day: "אין לוח" invites the admin
  // to rebuild or duplicate onto a day that actually has slots.
  const loadError = "error" in scheduleResult ? scheduleResult.error : null;
  const slots = "success" in scheduleResult ? scheduleResult.data : [];
  // A summaries failure only hides the built/not-built badges — not worth
  // failing the whole page over.
  const sessionSummaries =
    "success" in summariesResult ? summariesResult.data : {};
  const trainers =
    trainersResult && "success" in trainersResult ? trainersResult.data : [];
  const trainees =
    traineesResult && "success" in traineesResult ? traineesResult.data : [];

  return (
    <ScheduleDayView
      date={date}
      today={israelToday()}
      slots={slots}
      sessionSummaries={sessionSummaries}
      loadError={loadError}
      isAdmin={isAdmin}
      currentUserId={user!.id}
      trainers={trainers}
      trainees={trainees}
    />
  );
}
