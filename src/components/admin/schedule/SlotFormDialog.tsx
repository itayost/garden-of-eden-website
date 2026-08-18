"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { cn } from "@/lib/utils";
import { createSlotAction, updateSlotAction } from "@/lib/actions/daily-schedule";
import { trainersAtTime } from "@/lib/utils/weekly-schedule";
import type { ScheduleSlot } from "@/types/schedule";
import type { OnDuty } from "@/types/weekly-schedule";

const NO_TRAINER_VALUE = "__none__";

/** The academy's operating hours, from the real daily schedule. */
const HOUR_PRESETS = ["15:00", "16:00", "17:00", "18:00", "19:00"];

const DEFAULT_START_TIME = "15:00";

/**
 * The distinct trainers the weekly schedule puts on this hour.
 *
 * Deduplicated by trainer: someone covering two overlapping stretches is still
 * one choice, and offering their name twice would read as a bug.
 */
function suggestTrainers(onDuty: OnDuty | null, time: string) {
  if (!onDuty) return [];
  const seen = new Set<string>();
  return trainersAtTime(onDuty, time).filter((band) => {
    if (seen.has(band.trainerId)) return false;
    seen.add(band.trainerId);
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initialStartTime = slot
    ? slot.start_time.slice(0, 5)
    : DEFAULT_START_TIME;

  const [startTime, setStartTime] = useState(initialStartTime);
  const [trainerId, setTrainerId] = useState<string | null>(() => {
    // Editing keeps whatever the slot already says, including "no trainer" —
    // the week must never silently rewrite a decision someone made.
    if (slot) return slot.trainer_id;
    const suggested = suggestTrainers(onDuty, initialStartTime);
    return suggested.length === 1 ? suggested[0].trainerId : null;
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
    setTrainerId(suggested.length === 1 ? suggested[0].trainerId : null);
  };

  const chooseTrainer = (next: string | null) => {
    setTrainerTouched(true);
    setTrainerId(next);
  };
  const [focus, setFocus] = useState(slot?.focus_he ?? "");
  const [location, setLocation] = useState(slot?.location_he ?? "");
  const [roster, setRoster] = useState<RosterEntry[]>(
    slot
      ? slot.trainees.map((t) => ({ traineeId: t.trainee_id, name: t.trainee_name }))
      : [],
  );
  const [search, setSearch] = useState("");
  // Keyboard highlight over the suggestion list; -1 = nothing highlighted.
  const [highlighted, setHighlighted] = useState(-1);

  const suggestions = useMemo(() => {
    const term = search.trim();
    if (!term) return [];
    const taken = new Set(
      roster.filter((r) => r.traineeId).map((r) => r.traineeId),
    );
    return trainees
      .filter(
        (t) =>
          !taken.has(t.id) &&
          (t.full_name ?? "").toLowerCase().includes(term.toLowerCase()),
      )
      .slice(0, 6);
  }, [search, trainees, roster]);

  const addLinked = (trainee: TrainerOption) => {
    setRoster((prev) => [
      ...prev,
      { traineeId: trainee.id, name: trainee.full_name ?? "ללא שם" },
    ]);
    setSearch("");
  };

  // A typed name with no account: added as free text. The roster must not
  // force account creation — Eden's lists include kids not yet in the system.
  const addFreeText = () => {
    const name = search.trim();
    if (!name) return;
    if (roster.some((r) => r.name === name)) {
      toast.error("השם כבר ברשימה");
      return;
    }
    setRoster((prev) => [...prev, { traineeId: null, name }]);
    setSearch("");
  };

  const removeEntry = (index: number) => {
    setRoster((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (roster.length === 0) {
      toast.error("יש להוסיף לפחות מתאמן אחד");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        scheduleDate: slot?.schedule_date ?? date,
        startTime,
        trainerId,
        focus,
        location,
        trainees: roster.map((entry) => ({
          traineeId: entry.traineeId ?? undefined,
          name: entry.name,
        })),
      };

      const result = slot
        ? await updateSlotAction({ ...payload, slotId: slot.id })
        : await createSlotAction(payload);

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
            שעה, מאמן, מתאמנים ופוקוס — קבוצה אחת בלוח היומי.
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
              <Label htmlFor="slot-trainer">מאמן</Label>
              {/* Who the weekly schedule puts on this hour — one tap, and the
                  full list stays below for anything the week did not plan. */}
              {suggestedTrainers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestedTrainers.map((band) => (
                    <button
                      key={band.trainerId}
                      type="button"
                      onClick={() => chooseTrainer(band.trainerId)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        trainerId === band.trainerId
                          ? "border-forest bg-forest text-cream"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {band.trainerName}
                    </button>
                  ))}
                </div>
              )}
              <Select
                value={trainerId ?? NO_TRAINER_VALUE}
                onValueChange={(value) =>
                  chooseTrainer(value === NO_TRAINER_VALUE ? null : value)
                }
              >
                <SelectTrigger id="slot-trainer">
                  <SelectValue placeholder="ללא מאמן" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRAINER_VALUE}>ללא מאמן</SelectItem>
                  {trainers.map((trainer) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.full_name ?? "ללא שם"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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

            <div className="flex gap-2">
              <Input
                id="slot-roster-search"
                value={search}
                placeholder="חיפוש מתאמן או שם חופשי..."
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={
                  suggestions.length > 0 ? "slot-roster-suggestions" : undefined
                }
                aria-activedescendant={
                  highlighted >= 0 && suggestions[highlighted]
                    ? `roster-option-${suggestions[highlighted].id}`
                    : undefined
                }
                onChange={(event) => {
                  setSearch(event.target.value);
                  setHighlighted(-1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlighted((h) => Math.max(h - 1, -1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    // A highlighted suggestion wins; otherwise a single match
                    // is unambiguous; otherwise the text is a free-text name.
                    if (highlighted >= 0 && suggestions[highlighted]) {
                      addLinked(suggestions[highlighted]);
                      setHighlighted(-1);
                    } else if (suggestions.length === 1) {
                      addLinked(suggestions[0]);
                    } else {
                      addFreeText();
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addFreeText}
                disabled={!search.trim()}
                aria-label="הוספת שם חופשי"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div
                id="slot-roster-suggestions"
                role="listbox"
                aria-label="הצעות מתאמנים"
                className="rounded-md border"
              >
                {suggestions.map((trainee, index) => (
                  <button
                    key={trainee.id}
                    id={`roster-option-${trainee.id}`}
                    role="option"
                    aria-selected={index === highlighted}
                    type="button"
                    onClick={() => addLinked(trainee)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
                      index === highlighted ? "bg-muted" : "hover:bg-muted",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-bold text-forest">
                      {(trainee.full_name ?? "?").slice(0, 1)}
                    </span>
                    {trainee.full_name ?? "ללא שם"}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              שם שלא נמצא במערכת נוסף כטקסט חופשי (מסומן במסגרת).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slot-focus">פוקוס (אופציונלי)</Label>
            <Input
              id="slot-focus"
              value={focus}
              placeholder="לדוגמה: זריזות מהירות טכניקה עם כדור"
              onChange={(event) => setFocus(event.target.value)}
            />
          </div>

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
