"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDueDate } from "@/lib/utils/tasks";
import { ENERGY_LABELS, formatSleepHours, type Checkin } from "../lib/checkin";
import { getTraineeCheckinsAction } from "../lib/actions/staff-checkins";

/** The trainee page's last two weeks of Check-ins, read on open. */
export function TraineeCheckinsCard({ traineeId }: { traineeId: string }) {
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTraineeCheckinsAction(traineeId).then((result) => {
      if (cancelled) return;
      if (result.success) setCheckins(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [traineeId]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Moon className="h-5 w-5" />
          צ׳ק-אין יומי
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : checkins === null ? (
          <Skeleton className="h-20 w-full" />
        ) : checkins.length === 0 ? (
          <p className="text-sm text-muted-foreground">עוד לא מולא צ׳ק-אין בשבועיים האחרונים</p>
        ) : (
          <ul className="divide-y text-sm">
            {checkins.map((checkin) => (
              <li key={checkin.date} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="w-24 shrink-0 font-medium tabular-nums">{formatDueDate(checkin.date)}</span>
                <span className="tabular-nums">שינה {formatSleepHours(checkin.sleepHours)} שעות</span>
                <span className="tabular-nums">
                  אנרגיה {checkin.energy}/5 · {ENERGY_LABELS[checkin.energy]}
                </span>
                {checkin.soreness && <span className="text-warning-emphasis">עייפות שרירים</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
