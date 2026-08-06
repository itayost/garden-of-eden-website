"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ScheduleSlot } from "@/types/schedule";

const NO_TRAINER_VALUE = "__none__";

/** The academy's operating hours, from the real daily schedule. */
const HOUR_PRESETS = ["15:00", "16:00", "17:00", "18:00", "19:00"];

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
}

export function SlotFormDialog({
  open,
  onOpenChange,
  date,
  slot,
  trainers,
  trainees,
}: SlotFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [startTime, setStartTime] = useState(
    slot ? slot.start_time.slice(0, 5) : "15:00",
  );
  const [trainerId, setTrainerId] = useState<string | null>(
    slot?.trainer_id ?? null,
  );
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{slot ? "עריכת סלוט" : "סלוט חדש"}</DialogTitle>
          <DialogDescription>
            שעה, מאמן, מתאמנים ופוקוס — קבוצה אחת בלוח היומי.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="slot-time">שעה</Label>
              {/* The academy's real hours — one tap beats the time picker. */}
              <div className="flex flex-wrap gap-1">
                {HOUR_PRESETS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => setStartTime(hour)}
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
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-trainer">מאמן</Label>
              <Select
                value={trainerId ?? NO_TRAINER_VALUE}
                onValueChange={(value) =>
                  setTrainerId(value === NO_TRAINER_VALUE ? null : value)
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

          <div className="flex justify-end gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
