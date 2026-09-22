"use client";

import { useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DaySessionStatus } from "@/lib/schedule/day-session-status";
import type { WeekDay } from "@/lib/utils/schedule-week";
import type { ScheduleSlot } from "@/types/schedule";
import { DaySlotCard } from "./DaySlotCard";

interface CalendarDayListProps {
  /** Null for an empty Saturday. */
  day: WeekDay | null;
  onOpenSlot: (slot: ScheduleSlot) => void;
  onAddSlot: () => void;
  /** trainee id -> session status on this day; absent = not built. */
  /** This day's statuses, keyed by slot id and then by trainee id. */
  statuses: Record<string, Record<string, DaySessionStatus>>;
  /** The statuses query failed; no chip may claim "לא נבנה". */
  statusesLoaded: boolean;
  builderHrefFor: (slot: ScheduleSlot, traineeId: string) => string;
}

/** One day's slots on the timeline rail, grouped by hour. */
export function CalendarDayList({
  day,
  onOpenSlot,
  onAddSlot,
  statuses,
  statusesLoaded,
  builderHrefFor,
}: CalendarDayListProps) {
  const byTime = useMemo(() => {
    const groups = new Map<string, ScheduleSlot[]>();
    for (const slot of day?.slots ?? []) {
      const time = slot.start_time.slice(0, 5);
      groups.set(time, [...(groups.get(time) ?? []), slot]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [day]);

  if (byTime.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="rounded-full bg-muted p-3">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-muted-foreground">אין סלוטים ביום הזה</p>
          <Button onClick={onAddSlot}>
            <Plus className="h-4 w-4" />
            סלוט חדש
          </Button>
        </CardContent>
      </Card>
    );
  }

  const absentTrainerIds = new Set(day?.onDuty.absences.map((absence) => absence.trainerId) ?? []);

  return (
    <div className="ms-1.5 space-y-6 border-s-2 border-border ps-5">
      {byTime.map(([time, group]) => (
        <section key={time} className="relative space-y-2">
          <span
            className="absolute -start-[27px] top-2 h-3 w-3 rounded-full bg-grass ring-4 ring-background"
            aria-hidden="true"
          />
          <h3 className="font-display text-xl text-forest tabular-nums">{time}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.map((slot) => (
              <DaySlotCard
                key={slot.id}
                slot={slot}
                isTrainerAbsent={// The hour is only "unstaffed by absence" when nobody on it is left.
                slot.trainers.length > 0 &&
                slot.trainers.every(
                  (t) => t.trainer_id !== null && absentTrainerIds.has(t.trainer_id),
                )}
                onOpen={() => onOpenSlot(slot)}
                statuses={statuses[slot.id] ?? {}}
                statusesLoaded={statusesLoaded}
                builderHrefFor={(traineeId) => builderHrefFor(slot, traineeId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
