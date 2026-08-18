"use client";

import Link from "next/link";
import { CalendarDays, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import type { Week } from "@/lib/utils/schedule-week";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";
import { DatedWeekView } from "./DatedWeekView";
import { WeeklyScheduleView } from "./WeeklyScheduleView";

interface WeeklySchedulePageClientProps {
  week: Week;
  weekStart: string;
  /** Bands and the exceptions inside the template panel's own window. */
  bands: WeeklyBand[];
  exceptions: WeeklyException[];
  panelFromDate: string;
  panelToDate: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** The week's slots could not be read. */
  slotsError: string | null;
  /** The standing template could not be read. */
  templateError: string | null;
}

/**
 * Two views of the same thing, side by side on purpose.
 *
 * "השבוע הזה" is a real week with dates — what is actually on the board on each
 * day. "תבנית קבועה" is the standing pattern those days are seeded from, which
 * belongs to no date at all. Keeping them one page is what makes the
 * relationship visible: the template is the default, the week is the record.
 *
 * The tab is local state while the week lives in the URL. The week is the part
 * worth sharing and returning to; the tab is where you happen to be standing.
 */
export function WeeklySchedulePageClient({
  week,
  weekStart,
  bands,
  exceptions,
  panelFromDate,
  panelToDate,
  isAdmin,
  trainers,
  trainees,
  slotsError,
  templateError,
}: WeeklySchedulePageClientProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-xl">לוח שבועי</span>
        </div>

        <Button variant="outline" asChild>
          <Link href="/admin/schedule">
            <CalendarDays className="h-4 w-4" />
            ללוח היומי
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="week" dir="rtl">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="week">השבוע הזה</TabsTrigger>
          <TabsTrigger value="template">תבנית קבועה</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4">
          <DatedWeekView
            week={week}
            weekStart={weekStart}
            isAdmin={isAdmin}
            trainers={trainers}
            trainees={trainees}
            loadError={slotsError}
            templateFailed={templateError !== null}
          />
        </TabsContent>

        <TabsContent value="template" className="mt-4">
          <WeeklyScheduleView
            bands={bands}
            exceptions={exceptions}
            fromDate={panelFromDate}
            toDate={panelToDate}
            isAdmin={isAdmin}
            trainers={trainers}
            loadError={templateError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
