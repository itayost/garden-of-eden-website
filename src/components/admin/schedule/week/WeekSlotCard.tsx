"use client";

import { CalendarOff, MapPin, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { rosterLabel } from "@/lib/utils/roster-label";
import { firstTrainerId, trainerColor, trainerNames } from "@/lib/utils/trainer-color";
import type { ScheduleSlot } from "@/types/schedule";

interface WeekSlotCardProps {
  slot: ScheduleSlot;
  /**
   * The weekly schedule records this slot's trainer as away on this date.
   * A board that still staffs them is the contradiction worth surfacing.
   */
  isTrainerAbsent: boolean;
  /** Opens the calendar's roster sheet for this slot. */
  onOpen: () => void;
}

/**
 * One slot in the calendar, in the phone day list and the desktop week grid.
 *
 * Narrow on purpose: the hour, who takes it, and how full it is. Tapping it
 * opens the roster sheet, which is where names are added, removed and where
 * the slot is edited or deleted. It carries no session status; building
 * sessions is the בניית אימונים screen.
 */
export function WeekSlotCard({ slot, isTrainerAbsent, onOpen }: WeekSlotCardProps) {
  const palette = trainerColor(firstTrainerId(slot.trainers));
  const rosterCount = slot.trainees.filter((t) => t.cancelled_at === null).length;
  const overCapacity = slot.max_trainees !== null && rosterCount > slot.max_trainees;
  const seats = slot.max_trainees === null ? null : `${rosterCount}/${slot.max_trainees} מקומות`;
  const subtitle = slot.focus_he ?? slot.location_he;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-xl border p-2.5 text-start transition-colors",
        "hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        palette.bg,
      )}
      aria-label={`רשימת המתאמנים של ${trainerNames(slot.trainers) || "ללא מאמן"} בשעה ${slot.start_time.slice(0, 5)}`}
    >
      <p className="font-display text-sm tabular-nums text-forest">
        {slot.start_time.slice(0, 5)}
      </p>

      <div className="mt-1 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", palette.dot)} />
        <span className={cn("truncate text-sm font-bold", palette.text)}>
          {trainerNames(slot.trainers) || "ללא מאמן"}
        </span>
        {isTrainerAbsent && (
          <CalendarOff
            className="h-3.5 w-3.5 shrink-0 text-destructive"
            aria-label="המאמן רשום כנעדר בתאריך הזה"
          />
        )}
      </div>

      {subtitle && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          {!slot.focus_he && <MapPin className="h-3 w-3 shrink-0" />}
          {subtitle}
        </p>
      )}

      <p
        className={cn(
          "mt-1.5 flex items-center gap-1 text-[11px] tabular-nums",
          overCapacity ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        <Users className="h-3 w-3 shrink-0" />
        {rosterCount === 0 ? "אין רשומים" : seats ?? rosterLabel(rosterCount)}
      </p>
    </button>
  );
}
