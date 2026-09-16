"use client";

import Link from "next/link";
import { CalendarDays, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
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
 * The standing week and its exceptions. The dated week that used to be a tab
 * here is the calendar's week grid now (/admin/calendar).
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
  const { branchId } = useCurrentBranch();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-xl">לוח שבועי</span>
          <BranchSwitcher />
        </div>
        <Button variant="outline" asChild>
          <Link href={`/admin/calendar?branch=${branchId}`}>
            <CalendarDays className="h-4 w-4" />
            ליומן
          </Link>
        </Button>
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
