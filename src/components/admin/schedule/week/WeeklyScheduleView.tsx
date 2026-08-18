"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  SCHEDULED_WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
  type WeeklyBand,
  type WeeklyException,
} from "@/types/weekly-schedule";
import { BandCard } from "./BandCard";
import { BandFormDialog } from "./BandFormDialog";
import { ExceptionsPanel } from "./ExceptionsPanel";

interface WeeklyScheduleViewProps {
  bands: WeeklyBand[];
  exceptions: WeeklyException[];
  /** Window the exceptions list covers. */
  fromDate: string;
  toDate: string;
  /** Admins author the standing week; trainers read it. */
  isAdmin: boolean;
  trainers: TrainerOption[];
  /** Set when loading failed — never renders as an empty week. */
  loadError: string | null;
}

export function WeeklyScheduleView({
  bands,
  exceptions,
  fromDate,
  toDate,
  isAdmin,
  trainers,
  loadError,
}: WeeklyScheduleViewProps) {
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(false);
  const [formWeekday, setFormWeekday] = useState<Weekday>(0);
  const [editTarget, setEditTarget] = useState<WeeklyBand | null>(null);
  // Remount counter so create/edit dialogs initialize from fresh props.
  const [formInstance, setFormInstance] = useState(0);

  const byWeekday = useMemo(() => {
    const groups = new Map<Weekday, WeeklyBand[]>();
    for (const weekday of SCHEDULED_WEEKDAYS) groups.set(weekday, []);
    for (const band of bands) {
      // Saturday has no column; a band written there would vanish silently, so
      // it is never offered in the form.
      const group = groups.get(band.weekday);
      if (group) group.push(band);
    }
    return groups;
  }, [bands]);

  const openCreate = (weekday: Weekday) => {
    setFormWeekday(weekday);
    setEditTarget(null);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  const openEdit = (band: WeeklyBand) => {
    setFormWeekday(band.weekday);
    setEditTarget(band);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-12 text-center text-destructive">
          {loadError}
        </CardContent>
      </Card>
    );
  }

  const renderDay = (weekday: Weekday) => {
    const dayBands = byWeekday.get(weekday) ?? [];
    return (
      <div className="space-y-2">
        {dayBands.map((band) => (
          <BandCard
            key={band.id}
            band={band}
            canEdit={isAdmin}
            onEdit={() => openEdit(band)}
          />
        ))}

        {dayBands.length === 0 && (
          <p className="rounded-xl border border-dashed py-4 text-center text-xs text-muted-foreground">
            אין שיבוץ
          </p>
        )}

        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openCreate(weekday)}
            className="w-full text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            רצועה
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* The page header and the link to the daily board belong to the shell
          that owns both tabs. */}
      <p className="text-sm text-muted-foreground">
        מי עובד באיזו רצועה בכל יום בשבוע. הלוח הזה לא שייך לתאריך מסוים — הוא
        קובע מה ברירת המחדל, והלוח היומי עדיין נבנה יום-יום.
      </p>

      {/* One column per day on a desktop, stacked days on a phone — six
          columns of cards are unusable at 320px. Same split as ProgramGrid. */}
      {isMobile ? (
        <div className="space-y-5">
          {SCHEDULED_WEEKDAYS.map((weekday) => (
            <section key={weekday} className="space-y-2">
              <h2 className="font-display text-lg text-forest">
                {WEEKDAY_LABELS[weekday]}
              </h2>
              {renderDay(weekday)}
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {SCHEDULED_WEEKDAYS.map((weekday) => (
            <section key={weekday} className="space-y-2">
              <h2 className="rounded-lg bg-muted px-2 py-1.5 text-center font-display text-sm text-forest">
                {WEEKDAY_LABELS[weekday]}
              </h2>
              {renderDay(weekday)}
            </section>
          ))}
        </div>
      )}

      <ExceptionsPanel
        exceptions={exceptions}
        trainers={trainers}
        canEdit={isAdmin}
        fromDate={fromDate}
        toDate={toDate}
      />

      {isAdmin && (
        <BandFormDialog
          key={formInstance}
          open={formOpen}
          onOpenChange={setFormOpen}
          weekday={formWeekday}
          band={editTarget}
          trainers={trainers}
        />
      )}
    </div>
  );
}
