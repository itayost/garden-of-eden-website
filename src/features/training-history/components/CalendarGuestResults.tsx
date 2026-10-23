"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { shortDate } from "@/lib/utils/iso-date";
import { GUEST_SEARCH_MIN_LENGTH, type GuestGroup } from "@/lib/schedule/training-history";
import { searchCalendarGuestsAction, type GuestSearchResult } from "../lib/actions/training-history";
import { TrainingHistoryList } from "./TrainingHistoryList";

/**
 * Under the users list: names typed into a calendar roster with no account
 * that match the search, with how many trainings each did. Tapping one opens
 * its history.
 */
export function CalendarGuestResults({ query }: { query: string }) {
  const trimmed = query.trim();
  const active = trimmed.length >= GUEST_SEARCH_MIN_LENGTH;
  const [result, setResult] = useState<{ query: string; data: GuestSearchResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GuestGroup | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    searchCalendarGuestsAction(trimmed).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setResult({ query: trimmed, data: res.data });
        setError(null);
      } else {
        setError(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, trimmed]);

  // Results belong to the query that fetched them; a stale list is not shown.
  const groups = active && result?.query === trimmed ? result.data.groups : [];
  if (!active || (groups.length === 0 && !error)) return null;

  const branchNames = result?.data.branchNames ?? {};

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">ביומן ללא משתמש</h3>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {groups.map((group) => (
            <li key={group.key}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(group)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{group.name}</span>
                    {group.branchIds.map((id) => (
                      <Badge key={id} variant="secondary" className="text-[10px]">
                        {branchNames[id] ?? "סניף"}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {group.lastTrainingDate ? `אימון אחרון ${shortDate(group.lastTrainingDate)}` : "טרם התאמן"}
                    {group.upcoming > 0 && ` · ${group.upcoming} עתידיים`}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums">{group.used} אימונים</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{open?.name}</SheetTitle>
            <SheetDescription>שם שהוזן ביומן ללא חשבון משתמש</SheetDescription>
          </SheetHeader>
          {open && (
            <div className="px-4 pb-6">
              <TrainingHistoryList entries={open.entries} branchNames={branchNames} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
