"use client";

import { useState } from "react";
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
} from "./ShiftPeriodSelect";

interface RetroShiftRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RetroShiftRequestDialog({
  open,
  onOpenChange,
}: RetroShiftRequestDialogProps) {
  const router = useRouter();
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod>("regular");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isMorning = shiftPeriod === "morning";

  const reset = () => {
    setShiftPeriod("regular");
    setDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
  };

  // Switching to a morning shift prefills the window bounds; switching back
  // clears them rather than leaving morning hours on a regular shift.
  const handlePeriodChange = (next: ShiftPeriod) => {
    setShiftPeriod(next);
    if (next === "morning") {
      setStartTime(MORNING_START_VALUE);
      setEndTime(MORNING_END_VALUE);
    } else {
      setStartTime("");
      setEndTime("");
    }
  };

  // Picking a Friday after choosing morning has to fall back to regular —
  // Friday has no morning shift.
  const handleDateChange = (next: string) => {
    setDate(next);
    if (isFridayDateString(next) && shiftPeriod === "morning") {
      handlePeriodChange("regular");
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
        type: "retro_add",
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
      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשליחת הבקשה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>בקשה למשמרת רטרואקטיבית</DialogTitle>
          <DialogDescription>
            משמרת שלא נקלטה במערכת — הבקשה תישלח למנהל לאישור
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ShiftPeriodSelect
            id="retro-period"
            value={shiftPeriod}
            onChange={handlePeriodChange}
            disabled={loading}
            date={date}
          />

          <div className="space-y-2">
            <Label htmlFor="retro-date">תאריך *</Label>
            <Input
              id="retro-date"
              type="date"
              dir="ltr"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retro-start">שעת התחלה *</Label>
              <Input
                id="retro-start"
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
              <Label htmlFor="retro-end">שעת סיום *</Label>
              <Input
                id="retro-end"
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
            <Label htmlFor="retro-reason">סיבה (לא חובה)</Label>
            <Textarea
              id="retro-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: שכחתי להחתים כניסה"
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
