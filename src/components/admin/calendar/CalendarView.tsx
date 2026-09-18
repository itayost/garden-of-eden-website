"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BuildDayButton } from "@/components/admin/schedule/BuildDayButton";
import { CopyWhatsAppButton } from "@/components/admin/schedule/CopyWhatsAppButton";
import { DuplicateDayButton } from "@/components/admin/schedule/DuplicateDayButton";
import { OnDutyStrip } from "@/components/admin/schedule/OnDutyStrip";
import { SlotFormDialog } from "@/components/admin/schedule/SlotFormDialog";
import { BuildWeekButton } from "@/components/admin/schedule/week/BuildWeekButton";
import { ExceptionFormDialog } from "@/components/admin/schedule/week/ExceptionFormDialog";
import { WeekDayColumn } from "@/components/admin/schedule/week/WeekDayColumn";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { findDay, visibleDays } from "@/lib/schedule/calendar";
import { hebrewWeekday } from "@/lib/utils/date";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import { isBuildableDay, weekRangeLabel, type Week, type WeekDay } from "@/lib/utils/schedule-week";
import type { StaffPlanBadge } from "@/types/plans";
import type { ScheduleSlot } from "@/types/schedule";
import { CalendarDayList } from "./CalendarDayList";
import { CalendarTabs } from "./CalendarTabs";
import { DateStrip } from "./DateStrip";
import { RosterSheet } from "./RosterSheet";

interface CalendarViewProps {
  week: Week;
  weekStart: string;
  /** The day from ?date=, already resolved by the page. */
  date: string;
  today: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  planBadges: Record<string, StaffPlanBadge>;
  /** The week's slots could not be read; never render as an empty week. */
  slotsError: string | null;
  /** The standing template could not be read; staffing cannot be claimed. */
  templateFailed: boolean;
}

/** What the slot form was opened for. A date and its staffing are one fact. */
interface SlotFormContext {
  date: string;
  slot: ScheduleSlot | null;
  day: WeekDay | null;
}

/**
 * The booking calendar: who is in which slot. It never builds sessions.
 *
 * Phone and desktop layouts render in one tree and switch with CSS. A
 * useIsMobile branch would render one layout on the server and remount on
 * hydration, closing any dialog opened in between.
 */
export function CalendarView({
  week,
  weekStart,
  date,
  today,
  isAdmin,
  trainers,
  trainees,
  planBadges,
  slotsError,
  templateFailed,
}: CalendarViewProps) {
  const { branchId } = useCurrentBranch();

  // Selecting a day inside the loaded week is client state mirrored to the
  // URL; a new ?date= from the server (week arrows) resets it.
  const [selectedDate, setSelectedDate] = useState(date);
  const [propDate, setPropDate] = useState(date);
  if (propDate !== date) {
    setPropDate(date);
    setSelectedDate(date);
  }

  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormContext | null>(null);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  // Remount counter: both dialogs initialise every field at mount.
  const [formInstance, setFormInstance] = useState(0);

  const days = visibleDays(week);
  const selectedDay = findDay(week, selectedDate);
  const selectedSlots = selectedDay?.slots ?? [];
  // Looked up from fresh props so router.refresh() updates an open sheet, and
  // a deleted slot closes it.
  const openSlot = days.flatMap((d) => d.slots).find((s) => s.id === openSlotId) ?? null;

  const buildable = week.days.filter(isBuildableDay);
  const buildableSlotCount = buildable.reduce((total, d) => total + d.onDuty.bands.length, 0);

  const hrefFor = (target: string) => `/admin/calendar?date=${target}&branch=${branchId}`;

  const selectDay = (target: string) => {
    setSelectedDate(target);
    window.history.replaceState(null, "", hrefFor(target));
  };

  const openSlotForm = (context: SlotFormContext) => {
    setOpenSlotId(null);
    setSlotForm(context);
    setFormInstance((n) => n + 1);
    setSlotFormOpen(true);
  };

  const openException = (day: WeekDay) => {
    setExceptionDate(day.date);
    setFormInstance((n) => n + 1);
    setExceptionOpen(true);
  };

  const dayLabel = `${hebrewWeekday(selectedDate)} · ${shortDate(selectedDate)}`;
  const inLoadedWeek = (target: string) => target >= weekStart && target <= addDays(weekStart, 6);
  const dayArrow = (delta: number) => {
    const target = addDays(selectedDate, delta);
    return inLoadedWeek(target) ? { onClick: () => selectDay(target) } : { href: hrefFor(target) };
  };

  return (
    <div className="space-y-5">
      <CalendarTabs />

      <div className="flex flex-wrap items-center gap-2">
        {/* Phone: one day at a time. RTL: "previous" points right. */}
        <div className="flex items-center gap-2 md:hidden">
          <ArrowButton label="יום קודם" icon="prev" {...dayArrow(-1)} />
          <span className="flex items-center gap-2 px-1 font-display text-lg">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {dayLabel}
          </span>
          <ArrowButton label="יום הבא" icon="next" {...dayArrow(1)} />
        </div>

        {/* Desktop: a week at a time. */}
        <div className="hidden items-center gap-2 md:flex">
          <ArrowButton label="שבוע קודם" icon="prev" href={hrefFor(addDays(weekStart, -7))} />
          <span className="flex items-center gap-2 px-1 font-display text-lg tabular-nums">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {weekRangeLabel(weekStart)}
          </span>
          <ArrowButton label="שבוע הבא" icon="next" href={hrefFor(addDays(weekStart, 7))} />
        </div>

        {/* Inside the loaded week "today" is client state: a Link to the same
            server date would leave the selection where it was. */}
        {selectedDate !== today &&
          (inLoadedWeek(today) ? (
            <Button variant="ghost" size="sm" onClick={() => selectDay(today)}>
              היום
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/calendar?branch=${branchId}`}>היום</Link>
            </Button>
          ))}
        <BranchSwitcher />
        <Button variant="ghost" size="icon" asChild aria-label="נוהל בטיחות וחירום">
          <Link href="/admin/safety">
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </Link>
        </Button>
      </div>

      {!slotsError && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">{dayLabel}:</span>
          <Button
            onClick={() => openSlotForm({ date: selectedDate, slot: null, day: selectedDay })}
            className="order-first w-full sm:order-none sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            סלוט חדש
          </Button>
          <CopyWhatsAppButton slots={selectedSlots} />
          {isAdmin && <DuplicateDayButton targetDate={selectedDate} targetHasSlots={selectedSlots.length > 0} />}
          {isAdmin && !templateFailed && selectedDay && selectedDay.onDuty.bands.length > 0 && (
            <BuildDayButton
              targetDate={selectedDate}
              targetHasSlots={selectedSlots.length > 0}
              bandCount={selectedDay.onDuty.bands.length}
            />
          )}
          {isAdmin && !templateFailed && (
            <div className="hidden md:block">
              <BuildWeekButton weekStart={weekStart} buildableCount={buildable.length} slotCount={buildableSlotCount} />
            </div>
          )}
        </div>
      )}

      {selectedDay && !templateFailed && <OnDutyStrip onDuty={selectedDay.onDuty} />}

      {slotsError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">{slotsError}</CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            <DateStrip days={days} selectedDate={selectedDate} onSelect={selectDay} />
            <CalendarDayList
              day={selectedDay}
              onOpenSlot={(slot) => setOpenSlotId(slot.id)}
              onAddSlot={() => openSlotForm({ date: selectedDate, slot: null, day: selectedDay })}
            />
          </div>

          <div className="hidden space-y-3 md:block">
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
              {week.days.map((day) => (
                <WeekDayColumn
                  key={day.date}
                  day={day}
                  isAdmin={isAdmin}
                  templateFailed={templateFailed}
                  isSelected={day.date === selectedDate}
                  onSelectDay={(target) => selectDay(target.date)}
                  onAddSlot={(target) => openSlotForm({ date: target.date, slot: null, day: target })}
                  onOpenSlot={(slot) => setOpenSlotId(slot.id)}
                  onAddException={openException}
                />
              ))}
            </div>
            {week.saturday && (
              <div className="max-w-xs rounded-2xl border border-dashed p-3">
                <WeekDayColumn
                  day={week.saturday}
                  isAdmin={isAdmin}
                  templateFailed={templateFailed}
                  isSelected={week.saturday.date === selectedDate}
                  onSelectDay={(target) => selectDay(target.date)}
                  onAddSlot={(target) => openSlotForm({ date: target.date, slot: null, day: target })}
                  onOpenSlot={(slot) => setOpenSlotId(slot.id)}
                  onAddException={openException}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/*
        Keyed by the open slot so each opening mounts a fresh sheet: the day's
        sessions are read on mount, and a session another trainer built
        meanwhile is never served from the last opening's state.
      */}
      <RosterSheet
        key={openSlot?.id ?? "closed"}
        slot={openSlot}
        onClose={() => setOpenSlotId(null)}
        trainees={trainees}
        planBadges={planBadges}
        isAdmin={isAdmin}
        onEditDetails={(slot) => openSlotForm({ date: slot.schedule_date, slot, day: findDay(week, slot.schedule_date) })}
      />

      {slotForm && (
        <SlotFormDialog
          key={`slot-${formInstance}`}
          open={slotFormOpen}
          onOpenChange={setSlotFormOpen}
          date={slotForm.date}
          slot={slotForm.slot}
          trainers={trainers}
          trainees={trainees}
          onDuty={slotForm.day?.onDuty ?? null}
          contextLabel={`${hebrewWeekday(slotForm.date)} · ${shortDate(slotForm.date)}`}
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

type ArrowButtonProps = { label: string; icon: "prev" | "next" } & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

/** RTL: "previous" is a right-pointing chevron. */
function ArrowButton({ label, icon, href, onClick }: ArrowButtonProps) {
  const Icon = icon === "prev" ? ChevronRight : ChevronLeft;
  if (href) {
    return (
      <Button variant="outline" size="icon" asChild aria-label={label}>
        <Link href={href}>
          <Icon className="h-4 w-4" />
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" onClick={onClick} aria-label={label}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
