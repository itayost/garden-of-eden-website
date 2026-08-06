"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { formatDate } from "@/lib/utils/date";
import type { ScheduleSlot } from "@/types/schedule";
import { CopyWhatsAppButton } from "./CopyWhatsAppButton";
import { DuplicateDayButton } from "./DuplicateDayButton";
import { SlotCard } from "./SlotCard";
import { SlotFormDialog } from "./SlotFormDialog";

interface ScheduleDayViewProps {
  /** The day being viewed, ISO YYYY-MM-DD. */
  date: string;
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
  slots: ScheduleSlot[];
  /** Set when loading failed — renders an error state, never a false empty day. */
  loadError: string | null;
  isAdmin: boolean;
  currentUserId: string;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
}

/** Date-only arithmetic on ISO strings; UTC throughout so no DST surprises. */
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function ScheduleDayView({
  date,
  today,
  slots,
  loadError,
  isAdmin,
  currentUserId,
  trainers,
  trainees,
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
            <span className="font-medium">{formatDate(date)}</span>
            {date === today && (
              <span className="text-xs text-muted-foreground">(היום)</span>
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

        <div className="flex flex-wrap items-center gap-2">
          <CopyWhatsAppButton slots={slots} />
          {isAdmin && (
            <>
              <DuplicateDayButton
                targetDate={date}
                // On a load error the real slot state is unknown; treating the
                // day as occupied disables duplication onto it.
                targetHasSlots={loadError !== null || slots.length > 0}
              />
              <Button onClick={openCreate} disabled={loadError !== null}>
                <Plus className="me-2 h-4 w-4" />
                סלוט חדש
              </Button>
            </>
          )}
        </div>
      </div>

      {loadError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין לוח ליום זה
            {isAdmin ? " — הוסף סלוט או שכפל מיום קודם." : "."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {byTime.map(([time, group]) => (
            <section key={time} className="space-y-3">
              <h2 className="border-b pb-1 text-lg font-semibold tabular-nums">
                {time}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    isAdmin={isAdmin}
                    isMine={slot.trainer_id === currentUserId}
                    onEdit={() => openEdit(slot)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {isAdmin && (
        <SlotFormDialog
          key={formInstance}
          open={formOpen}
          onOpenChange={setFormOpen}
          date={date}
          slot={editTarget}
          trainers={trainers}
          trainees={trainees}
        />
      )}
    </div>
  );
}
