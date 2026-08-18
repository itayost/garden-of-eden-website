"use client";

import { CalendarOff, LifeBuoy, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { trainerColor } from "@/lib/utils/trainer-color";
import { onDutyTimeLabel } from "@/lib/utils/weekly-schedule";
import type { OnDuty, OnDutyBand } from "@/types/weekly-schedule";

interface TemplateDayPreviewProps {
  onDuty: OnDuty;
}

function StretchLine({ band, muted }: { band: OnDutyBand; muted?: boolean }) {
  const palette = trainerColor(band.trainerId);

  return (
    <li className={cn("flex items-baseline gap-1.5", muted && "opacity-70")}>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {onDutyTimeLabel(band)}
      </span>
      <span className={cn("truncate font-medium", palette.text)}>
        {band.trainerName}
      </span>
      {band.labelHe && (
        <span className="truncate text-muted-foreground">· {band.labelHe}</span>
      )}
    </li>
  );
}

/**
 * What the standing template says about a day nobody has built yet.
 *
 * Muted on purpose: this is not a board, it is what a board would start from.
 * Standby is shown but set apart, because the build will not create it — a slot
 * asserts a group is happening and חיזוק במידת הצורך means nobody decided.
 */
export function TemplateDayPreview({ onDuty }: TemplateDayPreviewProps) {
  const hasAnything =
    onDuty.bands.length > 0 ||
    onDuty.standby.length > 0 ||
    onDuty.absences.length > 0;

  if (!hasAnything) {
    return (
      <p className="rounded-xl border border-dashed py-4 text-center text-xs text-muted-foreground">
        אין שיבוץ
      </p>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-dashed bg-muted/30 p-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">מהתבנית</p>

      <ul className="space-y-1 text-xs">
        {onDuty.bands.map((band) => (
          <li key={band.id}>
            <ul>
              <StretchLine band={band} />
            </ul>
            {band.locationHe && (
              <p className="flex items-center gap-1 ps-0.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {band.locationHe}
              </p>
            )}
          </li>
        ))}
      </ul>

      {onDuty.standby.length > 0 && (
        <div className="space-y-1 border-t border-dashed pt-1.5 text-xs">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <LifeBuoy className="h-3 w-3 shrink-0" />
            חיזוק במידת הצורך
          </p>
          <ul className="space-y-1">
            {onDuty.standby.map((band) => (
              <StretchLine key={band.id} band={band} muted />
            ))}
          </ul>
        </div>
      )}

      {onDuty.absences.length > 0 && (
        <ul className="space-y-0.5 border-t border-dashed pt-1.5 text-[11px] text-muted-foreground">
          {onDuty.absences.map((absence) => (
            <li key={absence.trainerId} className="flex items-start gap-1">
              <CalendarOff className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="truncate">
                {absence.trainerName} נעדר
                {absence.noteHe ? ` · ${absence.noteHe}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
