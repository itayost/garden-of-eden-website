"use client";

import { CalendarOff, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { WeekDay } from "@/lib/utils/schedule-week";
import type { ScheduleSlot } from "@/types/schedule";
import { WEEKDAY_LABELS } from "@/types/weekly-schedule";
import { BuildDayButton } from "../BuildDayButton";
import { DayDeviations } from "./DayDeviations";
import { TemplateDayPreview } from "./TemplateDayPreview";
import { WeekSlotCard } from "./WeekSlotCard";

interface WeekDayColumnProps {
  day: WeekDay;
  /** Building a day and writing exceptions are admin decisions. */
  isAdmin: boolean;
  /** The standing template failed to load; do not claim a day has no staffing. */
  templateFailed: boolean;
  onAddSlot: (day: WeekDay) => void;
  /** The day the calendar's header actions currently apply to. */
  isSelected: boolean;
  onSelectDay: (day: WeekDay) => void;
  onOpenSlot: (slot: ScheduleSlot) => void;
  onAddException: (day: WeekDay) => void;
}

/**
 * One date in the week: what is on the board, or what the template says should
 * be, and the two or three things worth doing without leaving the week.
 */
export function WeekDayColumn({
  day,
  isAdmin,
  templateFailed,
  onAddSlot,
  isSelected,
  onSelectDay,
  onOpenSlot,
  onAddException,
}: WeekDayColumnProps) {
  const absentTrainerIds = new Set(
    day.onDuty.absences.map((absence) => absence.trainerId),
  );

  return (
    <section className="space-y-2">
      <h2>
        <button
          type="button"
          onClick={() => onSelectDay(day)}
          aria-pressed={isSelected}
          className={cn(
            "flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 font-display text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            day.isToday ? "bg-forest text-cream" : "bg-muted text-forest hover:bg-muted/70",
            isSelected && "ring-2 ring-forest/50 ring-offset-1",
            day.isPast && !day.isToday && "opacity-70",
          )}
        >
          <span className="truncate">
            {WEEKDAY_LABELS[day.weekday]}{" "}
            <span className="tabular-nums opacity-80">{shortDate(day.date)}</span>
          </span>
        </button>
      </h2>

      {day.isBuilt ? (
        <div className="space-y-2">
          {day.slots.map((slot) => (
            <WeekSlotCard
              key={slot.id}
              slot={slot}
              isTrainerAbsent={
                slot.trainer_id !== null && absentTrainerIds.has(slot.trainer_id)
              }
              onOpen={() => onOpenSlot(slot)}
            />
          ))}
          <DayDeviations onDuty={day.onDuty} />
        </div>
      ) : templateFailed ? (
        <p className="rounded-xl border border-dashed py-4 text-center text-xs text-muted-foreground">
          לא ניתן לטעון את התבנית
        </p>
      ) : (
        <TemplateDayPreview onDuty={day.onDuty} />
      )}

      <div className="space-y-1">
        {/* Building is admin-only, needs a template, and refuses a day that
            already has a board — the same three conditions as the daily view. */}
        {isAdmin && !day.isBuilt && !templateFailed && day.onDuty.bands.length > 0 && (
          <BuildDayButton
            targetDate={day.date}
            targetHasSlots={false}
            bandCount={day.onDuty.bands.length}
            compact
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddSlot(day)}
          className="w-full text-xs text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          סלוט
        </Button>

        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddException(day)}
            className="w-full text-xs text-muted-foreground"
          >
            <CalendarOff className="h-3.5 w-3.5" />
            חריגה
          </Button>
        )}
      </div>
    </section>
  );
}
