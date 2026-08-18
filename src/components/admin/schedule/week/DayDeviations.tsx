"use client";

import { CalendarOff, UserPlus } from "lucide-react";

import { onDutyTimeLabel } from "@/lib/utils/weekly-schedule";
import type { OnDuty } from "@/types/weekly-schedule";

interface DayDeviationsProps {
  onDuty: OnDuty;
}

/**
 * What is unusual about this date, on a day whose board is already built.
 *
 * The routine staffing is not repeated here — the slots below already say who
 * takes what. What the slots cannot say is that someone the week expected is
 * away, or that a one-off was arranged, and those stay worth knowing after the
 * board exists.
 *
 * Reads only the derived staffing, never the raw exception rows: deriveOnDuty
 * suppresses an absence for a trainer who has no band that weekday, and this
 * line must agree with every other surface about what an absence means.
 */
export function DayDeviations({ onDuty }: DayDeviationsProps) {
  const extras = onDuty.bands.filter((band) => band.source === "exception");
  if (extras.length === 0 && onDuty.absences.length === 0) return null;

  return (
    <ul className="space-y-0.5 px-0.5 text-[11px] text-muted-foreground">
      {onDuty.absences.map((absence) => (
        <li key={absence.trainerId} className="flex items-start gap-1">
          <CalendarOff className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="truncate">
            {absence.trainerName} נעדר
            {absence.noteHe ? ` · ${absence.noteHe}` : ""}
          </span>
        </li>
      ))}

      {extras.map((extra) => (
        <li key={extra.id} className="flex items-start gap-1">
          <UserPlus className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="truncate">
            {extra.trainerName} · {onDutyTimeLabel(extra)}
            {extra.labelHe ? ` · ${extra.labelHe}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
