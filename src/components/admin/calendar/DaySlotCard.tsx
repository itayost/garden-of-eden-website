"use client";

import Link from "next/link";
import { CalendarCheck, CalendarOff, Check, Dumbbell, MapPin, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { rosterLabel } from "@/lib/utils/roster-label";
import { trainerColor } from "@/lib/utils/trainer-color";
import type { DaySessionStatus } from "@/lib/schedule/day-session-status";
import type { ScheduleSlot } from "@/types/schedule";

/** The chip per name: what a trainer still owes this trainee, at a glance. */
const CHIP = {
  not_built: { className: "bg-secondary text-secondary-foreground hover:bg-secondary/80", Icon: Plus },
  built: { className: "bg-primary text-primary-foreground hover:bg-primary/90", Icon: Dumbbell },
  completed: { className: "bg-success text-success-foreground hover:bg-success/90", Icon: Check },
} as const;

interface DaySlotCardProps {
  slot: ScheduleSlot;
  /**
   * The weekly schedule records this slot's trainer as away on this date.
   * A board that still staffs them is the contradiction worth surfacing.
   */
  isTrainerAbsent: boolean;
  /** Opens the calendar's roster sheet for this slot. */
  onOpen: () => void;
  /** trainee id -> session status for this slot's date; absent = not built. */
  statuses: Record<string, DaySessionStatus>;
  /** Null while the statuses are still unknown, so no chip claims "לא נבנה". */
  statusesLoaded: boolean;
  /** The session builder for one trainee in this slot. */
  builderHrefFor: (traineeId: string) => string;
}

/**
 * One slot in the phone day list: the hour, who takes it, and every name on
 * it with whether that trainee's session is built. A name goes straight to
 * the builder; the card's header opens the roster sheet, where names are
 * added and removed.
 *
 * The week grid keeps the narrower WeekSlotCard: at six columns the names do
 * not fit, and the day is where a roster is actually worked with.
 */
export function DaySlotCard({
  slot,
  isTrainerAbsent,
  onOpen,
  statuses,
  statusesLoaded,
  builderHrefFor,
}: DaySlotCardProps) {
  const palette = trainerColor(slot.trainer_id);
  const active = slot.trainees.filter((t) => t.cancelled_at === null);
  const overCapacity = slot.max_trainees !== null && active.length > slot.max_trainees;
  const seats = slot.max_trainees === null ? null : `${active.length}/${slot.max_trainees} מקומות`;
  const subtitle = slot.focus_he ?? slot.location_he;
  const time = slot.start_time.slice(0, 5);

  return (
    <div className={cn("rounded-xl border p-2.5", palette.bg)}>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-lg text-start transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`רשימת המתאמנים של ${slot.trainer_name ?? "ללא מאמן"} בשעה ${time}`}
      >
        <p className="font-display text-sm tabular-nums text-forest">{time}</p>

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
      </button>

      {active.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {active.map((entry) => {
            // A free-text name has no account, so it can hold no session and
            // there is nothing to build for it.
            if (!entry.trainee_id) {
              return (
                <li
                  key={entry.id}
                  className="inline-flex min-h-9 items-center rounded-full border border-dashed bg-background/60 px-2.5 text-xs text-muted-foreground"
                >
                  {entry.trainee_name}
                </li>
              );
            }

            const status = statuses[entry.trainee_id];
            const chip = CHIP[status?.status ?? "not_built"];
            return (
              <li key={entry.id}>
                <Link
                  href={builderHrefFor(entry.trainee_id)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    statusesLoaded ? chip.className : "bg-muted text-muted-foreground",
                  )}
                  aria-label={
                    status
                      ? `עריכת האימון של ${entry.trainee_name}`
                      : `בניית אימון עבור ${entry.trainee_name}`
                  }
                >
                  {statusesLoaded && <chip.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  {entry.source === "self" && (
                    <CalendarCheck className="h-3 w-3 shrink-0 opacity-70" aria-label="נרשם בעצמו" />
                  )}
                  <span className="max-w-[10rem] truncate">{entry.trainee_name}</span>
                  {statusesLoaded && status?.status === "built" && status.exerciseCount > 0 && (
                    <span className="tabular-nums opacity-80">{status.exerciseCount}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p
        className={cn(
          "mt-1.5 flex items-center gap-1 text-[11px] tabular-nums",
          overCapacity ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        <Users className="h-3 w-3 shrink-0" />
        {active.length === 0 ? "אין רשומים" : seats ?? rosterLabel(active.length)}
      </p>
    </div>
  );
}
