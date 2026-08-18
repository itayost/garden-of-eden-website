import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WeeklySchedulePageClient } from "@/components/admin/schedule/week/WeeklySchedulePageClient";
import { getSlotsForWeekAction } from "@/lib/actions/daily-schedule";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import {
  getExceptionsInRangeAction,
  getWeeklyScheduleAction,
} from "@/lib/actions/weekly-schedule";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { addDays } from "@/lib/utils/iso-date";
import { buildWeek, defaultWeekStart, startOfWeek } from "@/lib/utils/schedule-week";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "לוח שבועי | Garden of Eden",
};

/** How far ahead the exceptions list looks. Beyond this is not yet planned. */
const EXCEPTION_WINDOW_DAYS = 60;

/**
 * How far the week arrows may take you. A season in each direction covers every
 * real use, and the bound is what keeps a hand-typed ?week= from reaching a
 * date the arithmetic cannot express: addDays("9999-12-31", 1) returns
 * "+010000-01", which would reach PostgREST and could have real slots written
 * against it.
 */
const MAX_WEEK_OFFSET_DAYS = 364;

interface PageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function WeeklySchedulePage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();
  const params = await searchParams;

  // Any weekday normalises to its Sunday, so ?week=2026-08-19 and
  // ?week=2026-08-16 are one page. Out-of-range or malformed falls back
  // silently, as the daily board does with a bad ?date=. ISO strings compare
  // lexicographically, so the bounds are checked before any arithmetic runs.
  const raw = params.week;
  const inRange =
    !!raw &&
    isValidDateString(raw) &&
    raw >= addDays(today, -MAX_WEEK_OFFSET_DAYS) &&
    raw <= addDays(today, MAX_WEEK_OFFSET_DAYS);
  const weekStart = inRange ? startOfWeek(raw) : defaultWeekStart(today);
  const weekEnd = addDays(weekStart, 6);

  // The exceptions panel stays anchored to today whatever week is on screen: a
  // list that changed as you paged through weeks would stop answering "what is
  // coming up". A week back so an exception written for yesterday does not
  // vanish the moment it takes effect.
  const panelFromDate = addDays(today, -7);
  const panelToDate = addDays(today, EXCEPTION_WINDOW_DAYS);

  // Trainers read this page too, so the pick-list must come from the
  // admin-client action: under a trainer session the shared helper silently
  // drops admins who coach. Only admins can act on all of it, but a list that
  // is quietly missing people is worse than one they cannot use.
  const [slotsResult, templateResult, weekExceptionsResult, optionsResult] =
    await Promise.all([
      getSlotsForWeekAction(weekStart),
      getWeeklyScheduleAction(panelFromDate, panelToDate),
      getExceptionsInRangeAction(weekStart, weekEnd),
      getSlotFormOptionsAction(),
    ]);

  // Each failure degrades on its own. Slots failing must not render as a week
  // where nothing was ever built; the template failing must not render as a
  // week nobody works.
  const slotsError = "error" in slotsResult ? slotsResult.error : null;
  const slots = "success" in slotsResult ? slotsResult.data : [];

  const templateError =
    "error" in templateResult
      ? templateResult.error
      : "error" in weekExceptionsResult
        ? weekExceptionsResult.error
        : null;
  const bands = "success" in templateResult ? templateResult.data.bands : [];
  const panelExceptions =
    "success" in templateResult ? templateResult.data.exceptions : [];
  const weekExceptions =
    "success" in weekExceptionsResult ? weekExceptionsResult.data : [];

  const options =
    "success" in optionsResult
      ? optionsResult.data
      : { trainers: [], trainees: [] };

  // Derived on the server: seven days off one bands read and one exceptions
  // read, instead of seven round trips through getOnDutyAction.
  const week = buildWeek({
    weekStart,
    today,
    slots,
    bands,
    exceptions: weekExceptions,
  });

  return (
    <WeeklySchedulePageClient
      week={week}
      weekStart={weekStart}
      bands={bands}
      exceptions={panelExceptions}
      panelFromDate={panelFromDate}
      panelToDate={panelToDate}
      isAdmin={isAdmin}
      trainers={options.trainers}
      trainees={options.trainees}
      slotsError={slotsError}
      templateError={templateError}
    />
  );
}
