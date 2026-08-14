import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WeeklyScheduleView } from "@/components/admin/schedule/week/WeeklyScheduleView";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getWeeklyScheduleAction } from "@/lib/actions/weekly-schedule";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";

export const metadata: Metadata = {
  title: "לוח שבועי | Garden of Eden",
};

/** How far ahead the exceptions list looks. Beyond this is not yet planned. */
const EXCEPTION_WINDOW_DAYS = 60;

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function WeeklySchedulePage() {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();
  // A week back so an exception written for yesterday does not vanish the
  // moment it takes effect — the admin still wants to see what happened.
  const fromDate = addDays(today, -7);
  const toDate = addDays(today, EXCEPTION_WINDOW_DAYS);

  // Trainers read this page too, so the pick-list must come from the
  // admin-client action: under a trainer session the shared helper silently
  // drops admins who coach. Only admins can act on it, but a list that is
  // quietly missing people is worse than one they cannot use.
  const [scheduleResult, optionsResult] = await Promise.all([
    getWeeklyScheduleAction(fromDate, toDate),
    getSlotFormOptionsAction(),
  ]);

  // A load error must not render as an empty week: "אין שיבוץ" would invite the
  // admin to rebuild a schedule that already exists.
  const loadError = "error" in scheduleResult ? scheduleResult.error : null;
  const bands = "success" in scheduleResult ? scheduleResult.data.bands : [];
  const exceptions =
    "success" in scheduleResult ? scheduleResult.data.exceptions : [];
  const trainers =
    "success" in optionsResult ? optionsResult.data.trainers : [];

  return (
    <WeeklyScheduleView
      bands={bands}
      exceptions={exceptions}
      fromDate={fromDate}
      toDate={toDate}
      isAdmin={isAdmin}
      trainers={trainers}
      loadError={loadError}
    />
  );
}
