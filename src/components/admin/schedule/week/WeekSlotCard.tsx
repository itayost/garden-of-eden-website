"use client";

import { CalendarOff, MapPin, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { trainerColor } from "@/lib/utils/trainer-color";
import type { ScheduleSlot } from "@/types/schedule";

interface WeekSlotCardProps {
  slot: ScheduleSlot;
  /**
   * The weekly schedule records this slot's trainer as away on this date.
   * A board that still staffs them is the contradiction worth surfacing.
   */
  isTrainerAbsent: boolean;
  onEdit: () => void;
}

/** "6 מתאמנים", or the singular Hebrew reads wrong with a numeral. */
function rosterLabel(count: number): string {
  return count === 1 ? "מתאמן אחד" : `${count} מתאמנים`;
}

/**
 * One slot as it appears in a week column.
 *
 * Deliberately narrower than SlotCard: at six columns there is room for the
 * hour, who takes it, and how many names — the names themselves are one click
 * away on the daily board, which is where a roster is actually worked with. It
 * carries no delete either; deleting from a planning overview is the wrong
 * place for a confirmation dialog.
 *
 * A seeded slot says so instead of showing "0 מתאמנים", because a rosterless
 * slot is half-built rather than empty.
 */
export function WeekSlotCard({ slot, isTrainerAbsent, onEdit }: WeekSlotCardProps) {
  const palette = trainerColor(slot.trainer_id);
  const rosterCount = slot.trainees.length;
  const subtitle = slot.focus_he ?? slot.location_he;

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "w-full rounded-xl border p-2.5 text-start transition-colors",
        "hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
        palette.bg,
      )}
      aria-label={`עריכת הסלוט של ${slot.trainer_name ?? "ללא מאמן"} בשעה ${slot.start_time.slice(0, 5)}`}
    >
      <p className="font-display text-sm tabular-nums text-forest">
        {slot.start_time.slice(0, 5)}
      </p>

      <div className="mt-1 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", palette.dot)} />
        <span className={cn("truncate text-sm font-bold", palette.text)}>
          {slot.trainer_name ?? "ללא מאמן"}
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
          "mt-1.5 flex items-center gap-1 text-[11px]",
          // A seeded slot is unfinished work, not a styling variant.
          rosterCount === 0
            ? "font-medium text-gold"
            : "text-muted-foreground",
        )}
      >
        <Users className="h-3 w-3 shrink-0" />
        {rosterCount === 0 ? "הוספת מתאמנים" : rosterLabel(rosterCount)}
      </p>
    </button>
  );
}
