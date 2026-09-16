"use client";

import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { WeekDay } from "@/lib/utils/schedule-week";
import { WEEKDAY_LABELS } from "@/types/weekly-schedule";

interface DateStripProps {
  days: WeekDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

/** The phone's day picker, Arbox style: one row, today and the selection marked. */
export function DateStrip({ days, selectedDate, onSelect }: DateStripProps) {
  return (
    <div role="tablist" aria-label="ימי השבוע" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {days.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex min-w-12 flex-1 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
              selected ? "border-forest bg-forest text-cream" : "bg-background hover:bg-muted",
              !selected && day.isToday && "border-forest text-forest",
              !selected && day.isPast && "opacity-60",
            )}
          >
            <span className="text-[11px]">{WEEKDAY_LABELS[day.weekday]}</span>
            <span className="font-display text-sm tabular-nums">{shortDate(day.date)}</span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                day.slots.length > 0 ? (selected ? "bg-cream" : "bg-grass") : "bg-transparent",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
