"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import {
  isBuildableDay,
  weekRangeLabel,
  type Week,
  type WeekDay,
} from "@/lib/utils/schedule-week";
import type { ScheduleSlot } from "@/types/schedule";
import type { OnDuty } from "@/types/weekly-schedule";
import { WEEKDAY_LABELS } from "@/types/weekly-schedule";
import { SlotFormDialog } from "../SlotFormDialog";
import { BuildWeekButton } from "./BuildWeekButton";
import { ExceptionFormDialog } from "./ExceptionFormDialog";
import { WeekDayColumn } from "./WeekDayColumn";

interface DatedWeekViewProps {
  week: Week;
  /** The Sunday on screen, already normalised by the page. */
  weekStart: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** Set when the slots could not be read — never renders as an empty week. */
  loadError: string | null;
  /** The standing template could not be read; days cannot claim "אין שיבוץ". */
  templateFailed: boolean;
}

/**
 * The context a slot dialog was opened with.
 *
 * Held as one object rather than three pieces of state because it is one fact:
 * the dialog defaults its trainer from the day's staffing and writes to the
 * date it was handed, so a date from one column with staffing from another
 * would silently file the right group under the wrong trainer on the wrong day.
 */
interface SlotFormContext {
  date: string;
  onDuty: OnDuty;
  slot: ScheduleSlot | null;
  label: string;
}

function dayLabel(day: WeekDay): string {
  return `${WEEKDAY_LABELS[day.weekday]} · ${shortDate(day.date)}`;
}

export function DatedWeekView({
  week,
  weekStart,
  isAdmin,
  trainers,
  trainees,
  loadError,
  templateFailed,
}: DatedWeekViewProps) {
  const [slotContext, setSlotContext] = useState<SlotFormContext | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  // Remount counter, shared by both dialogs. Every piece of their state is
  // initialised at mount, so reopening without a remount would carry the last
  // opening's roster, hour and trainer across.
  const [formInstance, setFormInstance] = useState(0);

  const openSlotForm = (day: WeekDay, slot: ScheduleSlot | null) => {
    setSlotContext({
      date: day.date,
      onDuty: day.onDuty,
      slot,
      label: dayLabel(day),
    });
    setFormInstance((n) => n + 1);
    setSlotOpen(true);
  };

  const openExceptionForm = (day: WeekDay) => {
    setExceptionDate(day.date);
    setFormInstance((n) => n + 1);
    setExceptionOpen(true);
  };

  const buildable = week.days.filter(isBuildableDay);
  const buildableSlotCount = buildable.reduce(
    (total, day) => total + day.onDuty.bands.length,
    0,
  );
  const isCurrentWeek = week.days.some((day) => day.isToday);

  const renderColumn = (day: WeekDay) => (
    <WeekDayColumn
      key={day.date}
      day={day}
      isAdmin={isAdmin}
      templateFailed={templateFailed}
      onAddSlot={(target) => openSlotForm(target, null)}
      onEditSlot={openSlotForm}
      onAddException={openExceptionForm}
    />
  );

  return (
    <div className="space-y-4">
      {/* RTL: the "previous week" arrow points right, as on the daily board. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild aria-label="שבוע קודם">
            <Link href={`/admin/weekly-schedule?week=${addDays(weekStart, -7)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-lg tabular-nums">
              {weekRangeLabel(weekStart)}
            </span>
            {isCurrentWeek && (
              <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-medium text-cream">
                השבוע
              </span>
            )}
          </div>

          <Button variant="outline" size="icon" asChild aria-label="שבוע הבא">
            <Link href={`/admin/weekly-schedule?week=${addDays(weekStart, 7)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/weekly-schedule">חזרה לשבוע הזה</Link>
            </Button>
          )}
        </div>

        {isAdmin && !loadError && !templateFailed && (
          <BuildWeekButton
            weekStart={weekStart}
            buildableCount={buildable.length}
            slotCount={buildableSlotCount}
          />
        )}
      </div>

      {loadError ? (
        // Never an empty week: six columns offering to build would read as
        // "nothing here was ever built".
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : (
        <>
          {buildable.length > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {buildable.length === 1
                ? "יום אחד בשבוע עדיין לא נבנה"
                : `${buildable.length} ימים בשבוע עדיין לא נבנו`}
              {": "}
              {buildable.map((day) => shortDate(day.date)).join(", ")}
            </p>
          )}

          {/* One column per day from xl down to a stacked phone, in one tree.
              A useIsMobile branch would render the desktop grid on the server
              and remount every column on hydration, taking any open dialog
              with it. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {week.days.map(renderColumn)}
          </div>

          {/* Saturday sits below rather than in the grid: the academy does not
              staff it, and a seventh column appearing would resize the six
              that matter. */}
          {week.saturday && (
            <div className="rounded-2xl border border-dashed p-3">
              <div className="max-w-xs">{renderColumn(week.saturday)}</div>
            </div>
          )}
        </>
      )}

      {slotContext && (
        <SlotFormDialog
          key={`slot-${formInstance}`}
          open={slotOpen}
          onOpenChange={setSlotOpen}
          date={slotContext.date}
          slot={slotContext.slot}
          trainers={trainers}
          trainees={trainees}
          onDuty={slotContext.onDuty}
          contextLabel={slotContext.label}
        />
      )}

      {exceptionDate && (
        <ExceptionFormDialog
          key={`exception-${formInstance}`}
          open={exceptionOpen}
          onOpenChange={setExceptionOpen}
          trainers={trainers}
          defaultDate={exceptionDate}
          canEdit={isAdmin}
        />
      )}
    </div>
  );
}
