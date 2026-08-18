"use client";

import Link from "next/link";
import { CalendarOff, LifeBuoy, MapPin, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { trainerColor } from "@/lib/utils/trainer-color";
import { onDutyTimeLabel } from "@/lib/utils/weekly-schedule";
import type { OnDuty, OnDutyBand } from "@/types/weekly-schedule";

interface OnDutyStripProps {
  onDuty: OnDuty;
}

/** Stretches sharing an hour range read as one line, the way Eden writes them. */
function groupByStretch(bands: OnDutyBand[]): [string, OnDutyBand[]][] {
  const groups = new Map<string, OnDutyBand[]>();
  for (const band of bands) {
    const key = onDutyTimeLabel(band);
    groups.set(key, [...(groups.get(key) ?? []), band]);
  }
  return [...groups.entries()];
}

/**
 * Who the weekly schedule puts on this day. Derived on every read from the
 * Bands and this date's Exceptions — nothing here is stored, so it cannot drift
 * from the weekly schedule it comes from.
 *
 * This is context, not the board: it says who is around, while the slots below
 * say what actually runs.
 */
export function OnDutyStrip({ onDuty }: OnDutyStripProps) {
  const hasAnything =
    onDuty.bands.length > 0 ||
    onDuty.standby.length > 0 ||
    onDuty.absences.length > 0;

  if (!hasAnything) return null;

  return (
    <Card className="border-forest/20 bg-forest/[0.03]">
      <CardContent className="space-y-2.5 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            על המשמרת היום
          </span>
          <Link
            href="/admin/weekly-schedule"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            לוח שבועי
          </Link>
        </div>

        <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
          {groupByStretch(onDuty.bands).map(([label, group]) => (
            <div key={label} className="space-y-0.5">
              <p className="font-display text-sm tabular-nums text-forest">
                {label}
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {group.map((band) => {
                  const palette = trainerColor(band.trainerId);
                  return (
                    <span
                      key={band.id}
                      className="flex items-center gap-1 text-sm"
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full", palette.dot)}
                        aria-hidden="true"
                      />
                      <span className={cn("font-bold", palette.text)}>
                        {band.trainerName}
                      </span>
                      {band.labelHe && (
                        <span className="text-xs text-muted-foreground">
                          {band.labelHe}
                        </span>
                      )}
                      {band.locationHe && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {band.locationHe}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {(onDuty.standby.length > 0 || onDuty.absences.length > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-forest/10 pt-2 text-xs text-muted-foreground">
            {onDuty.standby.length > 0 && (
              <span className="flex items-center gap-1">
                <LifeBuoy className="h-3 w-3" />
                חיזוק במידת הצורך:{" "}
                {onDuty.standby.map((b) => b.trainerName).join(", ")}
              </span>
            )}
            {onDuty.absences.map((absence) => (
              <span key={absence.trainerId} className="flex items-center gap-1">
                <CalendarOff className="h-3 w-3" />
                {absence.trainerName}
                {absence.noteHe ? ` — ${absence.noteHe}` : " — לא מגיע"}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
