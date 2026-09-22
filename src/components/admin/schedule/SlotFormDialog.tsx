"use client";

import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { TraineeSearch } from "./TraineeSearch";
import { cn } from "@/lib/utils";
import { createSlotAction, updateSlotAction } from "@/lib/actions/daily-schedule";
import { TrainerCheckboxGroup } from "@/components/admin/schedule/TrainerCheckboxGroup";
import { trainersAtTime } from "@/lib/utils/weekly-schedule";
import type { ScheduleSlot } from "@/types/schedule";
import type { OnDuty } from "@/types/weekly-schedule";

/** The academy's operating hours, from the real daily schedule. */
const HOUR_PRESETS = ["15:00", "16:00", "17:00", "18:00", "19:00"];

const DEFAULT_START_TIME = "15:00";

/**
 * The distinct trainers the weekly schedule puts on this hour.
 *
 * Deduplicated by trainer: someone covering two overlapping stretches is still
 * one choice, and offering their name twice would read as a bug. A stretch can
 * carry several trainers now, so this flattens across them.
 */
function suggestTrainers(onDuty: OnDuty | null, time: string) {
  if (!onDuty) return [];
  const seen = new Set<string>();
  return trainersAtTime(onDuty, time)
    .flatMap((band) => band.trainers)
    .filter((trainer) => {
      if (!trainer.id || seen.has(trainer.id)) return false;
      seen.add(trainer.id);
      return true;
    });
}

interface RosterEntry {
  traineeId: string | null;
  name: string;
}

interface SlotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day being viewed; new slots land on it. */
  date: string;
  /** Null = create mode. Parent remounts via key so state initializes fresh. */
  slot: ScheduleSlot | null;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** Who the weekly schedule puts on this day; feeds the trainer suggestion. */
  onDuty: OnDuty | null;
  /**
   * Which day this dialog was opened from, e.g. "יום רביעי · 19.8".
   *
   * The daily board leaves it unset — the page around the dialog already says
   * which day it is. The week view sets it, because there the same dialog
   * serves six columns and nothing else in it names the date it will write to.
   */
  contextLabel?: string;
}

export function SlotFormDialog({
  open,
  onOpenChange,
  date,
  slot,
  trainers,
  trainees,
  onDuty,
  contextLabel,
}: SlotFormDialogProps) {
  const { branchId } = useCurrentBranch();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initialStartTime = slot
    ? slot.start_time.slice(0, 5)
    : DEFAULT_START_TIME;

  const [startTime, setStartTime] = useState(initialStartTime);
  const [trainerIds, setTrainerIds] = useState<string[]>(() => {
    // Editing keeps whatever the slot already says, including "no trainer" —
    // the week must never silently rewrite a decision someone made.
    if (slot) {
      return [...slot.trainers]
        .sort((a, b) => a.order_index - b.order_index)
        .flatMap((t) => (t.trainer_id ? [t.trainer_id] : []));
    }
    // Everyone the standing week puts on this hour, which is right far more
    // often than empty is. Still only a default; the picker is right there.
    return suggestTrainers(onDuty, initialStartTime).flatMap((t) => (t.id ? [t.id] : []));
  });
  // Suggestions stop the moment the user expresses a preference. Edit mode
  // counts as already-decided.
  const [trainerTouched, setTrainerTouched] = useState(slot !== null);

  const suggestedTrainers = useMemo(
    () => suggestTrainers(onDuty, startTime),
    [onDuty, startTime],
  );

  /**
   * Moving the hour re-suggests the trainer, because "who is on at 16:00" is a
   * different question from "who is on at 19:00" — but only while the user has
   * not chosen one. A single covering trainer is filled in; two or more are
   * offered as chips, since guessing between them would be wrong half the time.
   */
  const changeStartTime = (next: string) => {
    setStartTime(next);
    if (trainerTouched) return;
    const suggested = suggestTrainers(onDuty, next);
    setTrainerIds(suggested.flatMap((t) => (t.id ? [t.id] : [])));
  };

  const chooseTrainers = (next: string[]) => {
    setTrainerTouched(true);
    setTrainerIds(next);
  };
  const [focus, setFocus] = useState(slot?.focus_he ?? "");
  const [maxTrainees, setMaxTrainees] = useState(
    slot?.max_trainees === null || slot?.max_trainees === undefined ? "" : String(slot.max_trainees),
  );
  const [location, setLocation] = useState(slot?.location_he ?? "");
  // Only a new slot takes names here. An existing slot's roster is edited one
  // entry at a time in the calendar, so this form cannot overwrite bookings.
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const isEdit = slot !== null;
  const activeCount = slot
    ? slot.trainees.filter((t) => t.cancelled_at === null).length
    : roster.length;

  const rosterIds = useMemo(
    () => new Set(roster.flatMap((entry) => (entry.traineeId ? [entry.traineeId] : []))),
    [roster],
  );

  const addLinked = (trainee: TrainerOption) => {
    setRoster((prev) => [
      ...prev,
      { traineeId: trainee.id, name: trainee.full_name ?? "ללא שם" },
    ]);
  };

  // A typed name with no account: added as free text. The roster must not
  // force account creation: Eden's lists include kids not yet in the system.
  const addFreeText = (name: string) => {
    if (roster.some((r) => r.name === name)) {
      toast.error("השם כבר ברשימה");
      return;
    }
    setRoster((prev) => [...prev, { traineeId: null, name }]);
  };

  const removeEntry = (index: number) => {
    setRoster((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // A bookable slot may be saved empty; it fills itself. An existing slot
    // that never had seats (seeded from the weekly schedule) may be edited
    // before names are added in the calendar; only dropping seats needs a name.
    const mustName = slot === null || slot.max_trainees !== null;
    if (mustName && activeCount === 0 && maxTrainees === "") {
      toast.error("יש להוסיף לפחות מתאמן אחד");
      return;
    }

    setLoading(true);
    try {
      const details = {
        branchId,
        scheduleDate: slot?.schedule_date ?? date,
        startTime,
        trainerIds,
        focus,
        location,
        maxTrainees: maxTrainees === "" ? null : Number(maxTrainees),
      };

      const result = slot
        ? await updateSlotAction({ ...details, slotId: slot.id })
        : await createSlotAction({
            ...details,
            trainees: roster.map((entry) => ({
              traineeId: entry.traineeId ?? undefined,
              name: entry.name,
            })),
          });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(slot ? "הסלוט עודכן" : "הסלוט נוצר");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הסלוט");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent>
        {/* Padding lives on the header and the body, not the surface, so the
            header and its close button stay put while the body scrolls. */}
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle>
            {slot ? "עריכת סלוט" : "סלוט חדש"}
            {contextLabel && (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {contextLabel}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "שעה, מאמן, פוקוס ומיקום. את המתאמנים מוסיפים ומסירים ברשימת הסלוט ביומן."
              : "שעה, מאמן, מתאמנים ופוקוס: קבוצה אחת ביומן."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6"
        >
          {/* One column on a phone: the hour chips and the trainer select each
              need the full width to stay tappable. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slot-time">שעה</Label>
              {/* The academy's real hours — one tap beats the time picker. */}
              <div className="flex flex-wrap gap-1">
                {HOUR_PRESETS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => changeStartTime(hour)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs tabular-nums transition-colors",
                      startTime === hour
                        ? "border-forest bg-forest text-cream"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {hour}
                  </button>
                ))}
              </div>
              <Input
                id="slot-time"
                type="time"
                value={startTime}
                onChange={(event) => changeStartTime(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-trainer">מאמנים</Label>
              {/* Who the weekly schedule puts on this hour — one tap adds them
                  all, and the full list stays below for anything the week did
                  not plan. */}
              {suggestedTrainers.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    chooseTrainers(suggestedTrainers.flatMap((t) => (t.id ? [t.id] : [])))
                  }
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  לפי השבוע הקבוע: {suggestedTrainers.map((t) => t.name).join(", ")}
                </button>
              )}
              <TrainerCheckboxGroup
                idPrefix="slot-trainer"
                trainers={trainers}
                value={trainerIds}
                onChange={chooseTrainers}
              />
            </div>
          </div>

          {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="slot-roster-search">מתאמנים</Label>

            {roster.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roster.map((entry, index) => (
                  <Badge
                    key={`${entry.name}-${index}`}
                    variant={entry.traineeId ? "secondary" : "outline"}
                    className="gap-1 pe-1 font-normal"
                  >
                    {entry.name}
                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      aria-label={`הסרת ${entry.name}`}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <TraineeSearch
              idPrefix="slot-roster"
              options={trainees}
              excludeIds={rosterIds}
              onPickLinked={addLinked}
              onPickFreeText={addFreeText}
            />
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="slot-focus">פוקוס (אופציונלי)</Label>
            <Input
              id="slot-focus"
              value={focus}
              placeholder="לדוגמה: זריזות מהירות טכניקה עם כדור"
              onChange={(event) => setFocus(event.target.value)}
            />
          </div>

          {slot?.max_trainees !== null && slot?.max_trainees !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="slot-seats">מקומות להרשמה עצמית</Label>
              <Input
                id="slot-seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                value={maxTrainees}
                onChange={(event) => setMaxTrainees(event.target.value)}
                onBlur={() => {
                  if (maxTrainees === "" || Number(maxTrainees) < 1) setMaxTrainees("1");
                }}
                className="w-24"
              />
              {maxTrainees !== "" && activeCount > Number(maxTrainees) && (
                <p className="text-xs text-destructive">
                  מעבר לקיבולת ({activeCount}/{maxTrainees}). הצוות רשאי, המתאמנים לא.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="slot-location">מיקום (אופציונלי)</Label>
            <Input
              id="slot-location"
              value={location}
              placeholder="לדוגמה: מגרש"
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          {/* Sticky inside the scrolling body: on a phone the roster can grow
              past the sheet, and שמירה must never be the thing you scroll to
              find. -mx cancels the body padding so the bar spans the surface. */}
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background px-4 pt-3 pb-1 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </form>
      </SheetDialogContent>
    </Dialog>
  );
}
