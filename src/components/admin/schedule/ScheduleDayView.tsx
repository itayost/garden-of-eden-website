"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import type { ScheduleSlot } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";
import type { OnDuty } from "@/types/weekly-schedule";
import { BuildDayButton } from "./BuildDayButton";
import { CopyWhatsAppButton } from "./CopyWhatsAppButton";
import { DuplicateDayButton } from "./DuplicateDayButton";
import { OnDutyStrip } from "./OnDutyStrip";
import { SlotCard } from "./SlotCard";
import { SlotFormDialog } from "./SlotFormDialog";

interface ScheduleDayViewProps {
  /** The day being viewed, ISO YYYY-MM-DD. */
  date: string;
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
  slots: ScheduleSlot[];
  /** trainee_id -> session summary, for the built/not-built chip indicators. */
  sessionSummaries: Record<string, SessionSummary>;
  /** Set when loading failed — renders an error state, never a false empty day. */
  loadError: string | null;
  /** Admin-only powers: whole-day duplication. Slots themselves are staff-wide. */
  isAdmin: boolean;
  currentUserId: string;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /**
   * Who the weekly schedule puts on this day. Null when it could not be loaded
   * — the strip and the build button hide rather than claim nobody is on.
   */
  onDuty: OnDuty | null;
}

/** Date-only arithmetic on ISO strings; UTC throughout so no DST surprises. */
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const HEBREW_WEEKDAYS = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
];

/** An operations tool runs on "יום רביעי", not on an ISO date. */
function weekdayName(date: string): string {
  return HEBREW_WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)}.${Number(month)}`;
}

export function ScheduleDayView({
  date,
  today,
  slots,
  sessionSummaries,
  loadError,
  isAdmin,
  currentUserId,
  trainers,
  trainees,
  onDuty,
}: ScheduleDayViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleSlot | null>(null);
  // Remount counter so create/edit dialogs initialize from fresh props.
  const [formInstance, setFormInstance] = useState(0);

  const byTime = useMemo(() => {
    const groups = new Map<string, ScheduleSlot[]>();
    for (const slot of slots) {
      const time = slot.start_time.slice(0, 5);
      groups.set(time, [...(groups.get(time) ?? []), slot]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const openCreate = () => {
    setEditTarget(null);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  const openEdit = (slot: ScheduleSlot) => {
    setEditTarget(slot);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Date navigation. RTL: the "previous day" arrow points right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild aria-label="יום קודם">
            <Link href={`/admin/schedule?date=${addDays(date, -1)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-xl">
              {weekdayName(date)} · {shortDate(date)}
            </span>
            {date === today && (
              <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-medium text-cream">
                היום
              </span>
            )}
          </div>

          <Button variant="outline" size="icon" asChild aria-label="יום הבא">
            <Link href={`/admin/schedule?date=${addDays(date, 1)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {date !== today && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/schedule">חזרה להיום</Link>
            </Button>
          )}
        </div>

        {/*
          On a phone the primary action takes its own full-width row above the
          secondary ones (order-first + w-full force the wrap) — the board is
          built from the field, and "סלוט חדש" must not end up as the third
          button in a cramped wrap. From sm up the row reads normally.
        */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            onClick={openCreate}
            disabled={loadError !== null}
            className="order-first w-full sm:order-none sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            סלוט חדש
          </Button>
          <CopyWhatsAppButton slots={slots} />
          {isAdmin && (
            <DuplicateDayButton
              targetDate={date}
              // On a load error the real slot state is unknown; treating the
              // day as occupied disables duplication onto it.
              targetHasSlots={loadError !== null || slots.length > 0}
            />
          )}
          {isAdmin && onDuty && onDuty.bands.length > 0 && (
            <BuildDayButton
              targetDate={date}
              targetHasSlots={loadError !== null || slots.length > 0}
              bandCount={onDuty.bands.length}
            />
          )}
        </div>
      </div>

      {/* Context above the board: who the week puts on today, whatever the
          slots below happen to say. Derived, so nothing here is a row. */}
      {onDuty && <OnDutyStrip onDuty={onDuty} />}

      {loadError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : slots.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="rounded-full bg-muted p-3">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-muted-foreground">
              {!isAdmin
                ? "אין לוח ליום זה — הוסף את הסלוט הראשון."
                : onDuty && onDuty.bands.length > 0
                  ? "אין לוח ליום זה — בנה מהלוח השבועי, שכפל מיום קודם, או הוסף סלוט."
                  : "אין לוח ליום זה — הוסף סלוט או שכפל מיום קודם."}
            </p>
            {/* On an empty day this is the most visible thing on the screen —
                the answer to "where do I add a slot from my phone". */}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              סלוט חדש
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Timeline rail: the day reads as a spine of hours, slots hanging off
        // it. RTL-aware — the rail sits on the start side.
        <div className="ms-1.5 space-y-8 border-s-2 border-border ps-5">
          {byTime.map(([time, group]) => (
            <section key={time} className="relative space-y-3">
              <span
                className="absolute -start-[27px] top-2.5 h-3 w-3 rounded-full bg-grass ring-4 ring-background"
                aria-hidden="true"
              />
              <h2 className="font-display text-2xl text-forest tabular-nums">
                {time}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    date={date}
                    sessionSummaries={sessionSummaries}
                    isMine={slot.trainer_id === currentUserId}
                    onEdit={() => openEdit(slot)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SlotFormDialog
        key={formInstance}
        open={formOpen}
        onOpenChange={setFormOpen}
        date={date}
        slot={editTarget}
        trainers={trainers}
        trainees={trainees}
        onDuty={onDuty}
      />
    </div>
  );
}
