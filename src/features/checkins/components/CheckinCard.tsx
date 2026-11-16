"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Moon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ENERGY_LABELS,
  ENERGY_LEVELS,
  SLEEP_DEFAULT,
  SLEEP_MAX,
  SLEEP_MIN,
  formatSleepHours,
  stepSleep,
  type Checkin,
  type EnergyLevel,
} from "../lib/checkin";
import { readCheckinSnooze, writeCheckinSnooze } from "../lib/snooze";
import { saveCheckinAction } from "../lib/actions/checkins";

interface CheckinCardProps {
  /** Today's Israel date, from the server. */
  today: string;
  saved: Checkin | null;
}

const choice = (chosen: boolean) =>
  cn(
    "min-h-11 rounded-xl border text-sm font-medium transition-colors disabled:opacity-60",
    chosen ? "border-primary bg-primary text-primary-foreground" : "border-black/10 hover:bg-muted/60",
  );

function savedLine(saved: Checkin): string {
  const soreness = saved.soreness ? "עם עייפות שרירים" : "בלי עייפות שרירים";
  return `שינה ${formatSleepHours(saved.sleepHours)} שעות · אנרגיה ${ENERGY_LABELS[saved.energy]} · ${soreness}`;
}

/** The daily Check-in: three quick answers, once a day. */
export function CheckinCard({ today, saved }: CheckinCardProps) {
  const router = useRouter();
  const [snoozed, setSnoozed] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(saved === null);
  const [sleep, setSleep] = useState(saved?.sleepHours ?? SLEEP_DEFAULT);
  const [energy, setEnergy] = useState<EnergyLevel | null>(saved?.energy ?? null);
  const [soreness, setSoreness] = useState<boolean | null>(saved?.soreness ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSnoozed(readCheckinSnooze() === today);
  }, [today]);

  // Read the snooze first, so a card put away for today never flashes in.
  if (snoozed === null) return null;
  if (snoozed && saved === null) return null;

  if (saved && !editing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <Moon className="h-5 w-5 shrink-0 text-forest" aria-hidden="true" />
            <p className="min-w-0">
              <span className="font-bold">הצ׳ק-אין של היום: </span>
              <span className="text-muted-foreground">{savedLine(saved)}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            עדכון
          </Button>
        </CardContent>
      </Card>
    );
  }

  const save = () => {
    if (energy === null || soreness === null) return;
    startTransition(async () => {
      const result = await saveCheckinAction({ sleepHours: sleep, energy, soreness });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("נשמר. תודה!");
      setEditing(false);
      router.refresh();
    });
  };

  const putAway = () => {
    writeCheckinSnooze(today);
    setSnoozed(true);
  };

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <Moon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm">
            <h2 className="font-bold">צ׳ק-אין יומי</h2>
            <p className="text-muted-foreground">שלוש שאלות קצרות, פחות מ-15 שניות.</p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">כמה שעות ישנת בלילה?</legend>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => setSleep((value) => stepSleep(value, -1))}
              disabled={pending || sleep <= SLEEP_MIN}
              aria-label="חצי שעה פחות"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <output className="min-w-20 text-center text-lg font-bold tabular-nums" aria-live="polite">
              {formatSleepHours(sleep)} שעות
            </output>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => setSleep((value) => stepSleep(value, 1))}
              disabled={pending || sleep >= SLEEP_MAX}
              aria-label="חצי שעה יותר"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">איך האנרגיה היום?</legend>
          <div className="grid grid-cols-5 gap-2">
            {ENERGY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={energy === level}
                onClick={() => setEnergy(level)}
                disabled={pending}
                className={cn(choice(energy === level), "flex flex-col items-center justify-center px-1 py-2")}
              >
                <span className="text-base font-bold tabular-nums">{level}</span>
                <span className="text-[11px] leading-tight">{ENERGY_LABELS[level]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">יש עייפות שרירים?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: "כן" },
              { value: false, label: "לא" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={soreness === option.value}
                onClick={() => setSoreness(option.value)}
                disabled={pending}
                className={choice(soreness === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending || energy === null || soreness === null} className="h-11">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            שמירה
          </Button>
          {saved ? (
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              ביטול
            </Button>
          ) : (
            <button
              type="button"
              onClick={putAway}
              disabled={pending}
              className="min-h-10 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              לא היום
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
