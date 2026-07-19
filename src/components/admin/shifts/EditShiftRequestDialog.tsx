"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitShiftChangeRequestAction } from "@/lib/actions/shift-change-requests";
import type { ShiftPeriod } from "@/lib/constants/shifts";
import {
  MORNING_END_VALUE,
  MORNING_START_VALUE,
  ShiftPeriodSelect,
  buildShiftRange,
  isFridayDateString,
  toLocalDateValue as toLocalDate,
  toLocalTimeValue as toLocalTime,
} from "./ShiftPeriodSelect";
import type { TrainerShift } from "@/types/database";

interface EditShiftRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: TrainerShift;
}

export function EditShiftRequestDialog({
  open,
  onOpenChange,
  shift,
}: EditShiftRequestDialogProps) {
  const router = useRouter();
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod>(
    shift.shift_period ?? "regular"
  );
  const [date, setDate] = useState(toLocalDate(shift.start_time));
  const [startTime, setStartTime] = useState(toLocalTime(shift.start_time));
  const [endTime, setEndTime] = useState(
    shift.end_time ? toLocalTime(shift.end_time) : ""
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isMorning = shiftPeriod === "morning";

  useEffect(() => {
    setShiftPeriod(shift.shift_period ?? "regular");
    setDate(toLocalDate(shift.start_time));
    setStartTime(toLocalTime(shift.start_time));
    setEndTime(shift.end_time ? toLocalTime(shift.end_time) : "");
    setReason("");
  }, [shift.id, shift.start_time, shift.end_time, shift.shift_period]);

  // Reclassifying to morning prefills the window bounds. Switching back keeps
  // the current times — unlike the retro dialog, they came from a real shift.
  const handlePeriodChange = (next: ShiftPeriod) => {
    setShiftPeriod(next);
    if (next === "morning") {
      setStartTime(MORNING_START_VALUE);
      setEndTime(MORNING_END_VALUE);
    }
  };

  // Friday has no morning shift; fall back to regular if the date moves there.
  const handleDateChange = (next: string) => {
    setDate(next);
    if (isFridayDateString(next) && shiftPeriod === "morning") {
      setShiftPeriod("regular");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      toast.error("יש למלא תאריך ושעות");
      return;
    }

    const { start: startDate, end: endDate } = buildShiftRange(
      date,
      startTime,
      endTime,
      shiftPeriod
    );

    setLoading(true);
    try {
      const result = await submitShiftChangeRequestAction({
        type: "edit",
        target_shift_id: shift.id,
        shift_period: shiftPeriod,
        requested_start_time: startDate.toISOString(),
        requested_end_time: endDate.toISOString(),
        reason: reason.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הבקשה נשלחה לאישור מנהל");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשליחת הבקשה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>בקשה לעדכון משמרת</DialogTitle>
          <DialogDescription>
            עדכון שעות התחלה / סיום של משמרת קיימת — הבקשה תישלח למנהל
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ShiftPeriodSelect
            id="edit-period"
            value={shiftPeriod}
            onChange={handlePeriodChange}
            disabled={loading}
            date={date}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-date">תאריך *</Label>
            <Input
              id="edit-date"
              type="date"
              dir="ltr"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start">שעת התחלה *</Label>
              <Input
                id="edit-start"
                type="time"
                dir="ltr"
                lang="he-IL"
                step={60}
                min={isMorning ? MORNING_START_VALUE : undefined}
                max={isMorning ? MORNING_END_VALUE : undefined}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">שעת סיום *</Label>
              <Input
                id="edit-end"
                type="time"
                dir="ltr"
                lang="he-IL"
                step={60}
                min={isMorning ? MORNING_START_VALUE : undefined}
                max={isMorning ? MORNING_END_VALUE : undefined}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">סיבה (לא חובה)</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: שכחתי לסיים משמרת בזמן"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              שלח בקשה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
