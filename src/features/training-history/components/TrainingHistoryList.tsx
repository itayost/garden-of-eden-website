"use client";

import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { shortDate } from "@/lib/utils/iso-date";
import { historySummary, type HistoryEntry, type HistoryStatus } from "@/lib/schedule/training-history";

const STATUS_LABELS: Record<HistoryStatus, string> = {
  attended: "התאמן",
  late_cancel: "ביטול מאוחר",
  cancelled: "בוטל",
  removed: "הוסר",
  called_off: "האימון בוטל",
  upcoming: "עתידי",
};

const STATUS_CLASSES: Record<HistoryStatus, string> = {
  attended: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  late_cancel: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  cancelled: "text-muted-foreground",
  removed: "text-muted-foreground",
  called_off: "text-muted-foreground",
  upcoming: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
};

/** Rows that did not use a session: hidden by the toggle. */
const NOT_HELD: readonly HistoryStatus[] = ["cancelled", "removed", "called_off"];

const INITIAL_VISIBLE_COUNT = 15;

function monthLabel(date: string): string {
  const [year, month] = date.split("-");
  return `${HEBREW_MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2 text-center">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

interface TrainingHistoryListProps {
  entries: readonly HistoryEntry[];
  branchNames: Readonly<Record<string, string>>;
}

/** A trainee's calendar trainings, newest first, grouped by month. */
export function TrainingHistoryList({ entries, branchNames }: TrainingHistoryListProps) {
  const switchId = useId();
  const [hideNotHeld, setHideNotHeld] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => historySummary(entries), [entries]);
  const shown = useMemo(
    () => (hideNotHeld ? entries.filter((e) => !NOT_HELD.includes(e.status)) : entries),
    [entries, hideNotHeld],
  );
  const visible = showAll ? shown : shown.slice(0, INITIAL_VISIBLE_COUNT);

  const months = useMemo(() => {
    const keys = [...new Set(visible.map((e) => e.schedule_date.slice(0, 7)))];
    return keys.map((key) => ({ key, entries: visible.filter((e) => e.schedule_date.startsWith(key)) }));
  }, [visible]);

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">אין אימונים ביומן</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryChip label="אימונים" value={summary.attended} />
        <SummaryChip label="ביטולים מאוחרים" value={summary.lateCancel} />
        <SummaryChip label="ביטולים" value={summary.cancelled + summary.removed} />
        <SummaryChip label="עתידיים" value={summary.upcoming} />
      </div>
      {summary.lastTrainingDate && (
        <p className="text-sm text-muted-foreground">
          אימון אחרון: {shortDate(summary.lastTrainingDate)}.{summary.lastTrainingDate.slice(0, 4)}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Switch id={switchId} checked={hideNotHeld} onCheckedChange={setHideNotHeld} />
        <Label htmlFor={switchId} className="text-sm font-normal">
          הסתרת ביטולים
        </Label>
      </div>

      {months.map((month) => (
        <div key={month.key} className="space-y-1">
          <h4 className="text-sm font-semibold">{monthLabel(month.key)}</h4>
          <ul className="divide-y rounded-md border">
            {month.entries.map((entry) => {
              const branch = entry.branch_id ? branchNames[entry.branch_id] : undefined;
              const details = [branch, entry.location_he, entry.trainer_names.join(", ")].filter(Boolean).join(" · ");
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium tabular-nums">
                      {shortDate(entry.schedule_date)} · <span dir="ltr">{entry.start_time.slice(0, 5)}</span>
                    </div>
                    {details && <div className="truncate text-xs text-muted-foreground">{details}</div>}
                  </div>
                  <Badge variant="outline" className={STATUS_CLASSES[entry.status]}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {shown.length > INITIAL_VISIBLE_COUNT && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "הצג פחות" : `הצג הכל (${shown.length})`}
        </Button>
      )}
    </div>
  );
}
