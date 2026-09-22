"use client";

import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrainerCheckboxGroup } from "@/components/admin/schedule/TrainerCheckboxGroup";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { cn } from "@/lib/utils";
import { createBandAction, updateBandAction } from "@/lib/actions/weekly-schedule";
import {
  SCHEDULED_WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
  type WeeklyBand,
} from "@/types/weekly-schedule";

/** The stretches the academy actually runs, from the real weekly schedule. */
const START_PRESETS = ["08:00", "15:00", "16:50", "18:00", "18:30"];

interface BandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The column the "add" button was pressed in; new bands land on it. */
  weekday: Weekday;
  /** Null = create mode. Parent remounts via key so state initializes fresh. */
  band: WeeklyBand | null;
  trainers: TrainerOption[];
}

export function BandFormDialog({
  open,
  onOpenChange,
  weekday,
  band,
  trainers,
}: BandFormDialogProps) {
  const { branchId } = useCurrentBranch();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [day, setDay] = useState<Weekday>(band?.weekday ?? weekday);
  const [startTime, setStartTime] = useState(
    band ? band.start_time.slice(0, 5) : "15:00",
  );
  // Empty means open-ended ("18:00 והלאה"), which the schema maps to NULL.
  const [endTime, setEndTime] = useState(band?.end_time?.slice(0, 5) ?? "");
  const [trainerIds, setTrainerIds] = useState<string[]>(() =>
    [...(band?.trainers ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((t) => (t.trainer_id ? [t.trainer_id] : [])),
  );
  const [location, setLocation] = useState(band?.location_he ?? "");
  const [label, setLabel] = useState(band?.label_he ?? "");
  const [isStandby, setIsStandby] = useState(band?.is_standby ?? false);
  const [isBookable, setIsBookable] = useState(band?.is_bookable ?? false);
  const [maxTrainees, setMaxTrainees] = useState(String(band?.max_trainees ?? 8));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (trainerIds.length === 0) {
      toast.error("יש לבחור לפחות מאמן אחד");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        branchId,
        weekday: day,
        startTime,
        endTime,
        trainerIds,
        location,
        label,
        isStandby,
        isBookable,
        maxTrainees: Number(maxTrainees),
      };

      const result = band
        ? await updateBandAction({ ...payload, bandId: band.id })
        : await createBandAction(payload);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(band ? "הרצועה עודכנה" : "הרצועה נוצרה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הרצועה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle>{band ? "עריכת רצועה" : "רצועה חדשה"}</DialogTitle>
          <DialogDescription>
            מאמן אחד, יום אחד בשבוע, מהשעה ועד השעה. שני מאמנים באותה רצועה הם
            שתי רצועות.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="space-y-2">
            <Label htmlFor="band-weekday">יום</Label>
            <Select
              value={String(day)}
              onValueChange={(value) => setDay(Number(value) as Weekday)}
            >
              <SelectTrigger id="band-weekday">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULED_WEEKDAYS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {WEEKDAY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="band-start">שעת התחלה</Label>
            {/* The academy's real starts — one tap beats the time picker. */}
            <div className="flex flex-wrap gap-1">
              {START_PRESETS.map((hour) => (
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
              id="band-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="band-end">שעת סיום</Label>
            <Input
              id="band-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
            {/* An empty end is how the admin already writes it; inventing a
                closing hour would put a number in the system nobody decided. */}
            <p className="text-xs text-muted-foreground">
              {endTime
                ? "הרצועה מסתיימת בשעה זו."
                : "ללא שעת סיום — הרצועה נמשכת עד סוף היום (״והלאה״)."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="band-trainer">מאמנים</Label>
            <TrainerCheckboxGroup
              idPrefix="band-trainer"
              trainers={trainers}
              value={trainerIds}
              onChange={setTrainerIds}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="band-location">מיקום (אופציונלי)</Label>
            <Input
              id="band-location"
              value={location}
              placeholder="לדוגמה: סטודיו, ביתר חיפה, עתלית"
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="band-label">קבוצה (אופציונלי)</Label>
            <Input
              id="band-label"
              value={label}
              placeholder="לדוגמה: נערים א׳"
              onChange={(event) => setLabel(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              משמש כפוקוס כשבונים יום מהתבנית השבועית.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox
              id="band-standby"
              checked={isStandby}
              onCheckedChange={(checked) => setIsStandby(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="band-standby" className="font-normal">
                חיזוק במידת הצורך
              </Label>
              <p className="text-xs text-muted-foreground">
                מוצג בשיבוץ היומי, אך לא נבנה ממנו סלוט — עוד לא הוחלט שהוא מגיע.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox
              id="band-bookable"
              checked={isBookable}
              onCheckedChange={(checked) => setIsBookable(checked === true)}
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="band-bookable" className="font-normal">
                פתוח להרשמה עצמית
              </Label>
              <p className="text-xs text-muted-foreground">
                מתאמני הסניף רואים את הסלוטים של הרצועה באפליקציה ונרשמים בעצמם, לפי המסלול שלהם.
                שינוי שעה או מאמן לא משנה סלוטים שכבר נוצרו; כיבוי ההרשמה סוגר אותם להרשמה מהיום.
              </p>
              {isBookable && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="band-seats" className="text-sm">מקומות</Label>
                  <Input
                    id="band-seats"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={40}
                    value={maxTrainees}
                    onChange={(event) => setMaxTrainees(event.target.value)}
                    className="h-9 w-20"
                  />
                </div>
              )}
            </div>
          </div>

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
