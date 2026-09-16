"use client";

import { CalendarTabs } from "@/components/admin/calendar/CalendarTabs";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";
import { WeeklyScheduleView } from "./WeeklyScheduleView";

interface WeeklySchedulePageClientProps {
  bands: WeeklyBand[];
  exceptions: WeeklyException[];
  panelFromDate: string;
  panelToDate: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  /** The standing template could not be read. */
  templateError: string | null;
}

/**
 * The standing week and its exceptions, shown as the calendar's second tab.
 * It names no dates: the calendar's days are seeded from it.
 */
export function WeeklySchedulePageClient({
  bands,
  exceptions,
  panelFromDate,
  panelToDate,
  isAdmin,
  trainers,
  templateError,
}: WeeklySchedulePageClientProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarTabs />
        <BranchSwitcher />
      </div>

      <WeeklyScheduleView
        bands={bands}
        exceptions={exceptions}
        fromDate={panelFromDate}
        toDate={panelToDate}
        isAdmin={isAdmin}
        trainers={trainers}
        loadError={templateError}
      />
    </div>
  );
}
