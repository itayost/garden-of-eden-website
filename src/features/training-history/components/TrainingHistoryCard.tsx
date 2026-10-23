"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck } from "lucide-react";
import { getTrainingHistoryAction, type TrainingHistory } from "../lib/actions/training-history";
import { TrainingHistoryList } from "./TrainingHistoryList";

/** The trainee page's training history, read from the calendar on open. */
export function TrainingHistoryCard({ traineeId }: { traineeId: string }) {
  const [history, setHistory] = useState<TrainingHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTrainingHistoryAction(traineeId).then((result) => {
      if (cancelled) return;
      if (result.success) setHistory(result.data);
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
          <CalendarCheck className="h-5 w-5" />
          היסטוריית אימונים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : history === null ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <TrainingHistoryList entries={history.entries} branchNames={history.branchNames} />
        )}
      </CardContent>
    </Card>
  );
}
