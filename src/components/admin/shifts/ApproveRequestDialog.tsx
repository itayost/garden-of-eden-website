"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
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
import {
  approveShiftChangeRequestAction,
  type ApproveTimesOverride,
} from "@/lib/actions/shift-change-requests";
import { normalizeShiftPeriod } from "@/lib/validations/shift-change-requests";
import type { ShiftPeriod } from "@/lib/constants/shifts";
import {
  MORNING_END_VALUE,
  MORNING_START_VALUE,
  toLocalDateValue,
  toLocalTimeValue,
} from "./ShiftPeriodSelect";

export interface ApproveRequestTimes {
  requested_start_time: string;
  requested_end_time: string;
  shift_period?: ShiftPeriod;
}

interface ApproveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  request: ApproveRequestTimes;
  summary: string;
  mergeNotice?: string | null;
  onSuccess?: () => void;
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  requestId,
  request,
  summary,
  mergeNotice,
  onSuccess,
}: ApproveRequestDialogProps) {
  const router = useRouter();
  const requestedStart = toLocalTimeValue(request.requested_start_time);
  const requestedEnd = toLocalTimeValue(request.requested_end_time);
  const [startTime, setStartTime] = useState(requestedStart);
  const [endTime, setEndTime] = useState(requestedEnd);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const isMorning = normalizeShiftPeriod(request.shift_period) === "morning";
  const timesChanged = startTime !== requestedStart || endTime !== requestedEnd;

  const resetForm = () => {
    setStartTime(requestedStart);
    setEndTime(requestedEnd);
    setNote("");
  };

  const handleConfirm = async () => {
    if (!startTime || !endTime) {
      toast.error("יש למלא שעת התחלה ושעת סיום");
      return;
    }

    // Each edited time keeps its own requested calendar day, so an overnight
    // request (start July 9, end July 10) stays split across the same days
    // and a same-day request can never silently roll onto the next day.
    let override: ApproveTimesOverride | undefined;
    if (timesChanged) {
      const start = new Date(
        `${toLocalDateValue(request.requested_start_time)}T${startTime}:00`
      );
      const end = new Date(
        `${toLocalDateValue(request.requested_end_time)}T${endTime}:00`
      );
      if (end <= start) {
        toast.error("שעת סיום חייבת להיות אחרי שעת התחלה");
        return;
      }
      override = {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      };
    }

    setLoading(true);
    try {

      const result = await approveShiftChangeRequestAction(
        requestId,
        note.trim() || undefined,
        override
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        timesChanged
          ? "הבקשה אושרה עם השעות שערכת"
          : "הבקשה אושרה ועודכנה במערכת"
      );
      resetForm();
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("שגיאה באישור הבקשה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>אישור בקשה</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        {mergeNotice && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {mergeNotice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="approve-start">שעת התחלה</Label>
            <Input
              id="approve-start"
              type="time"
              dir="ltr"
              lang="he-IL"
              step={60}
              min={isMorning ? MORNING_START_VALUE : undefined}
              max={isMorning ? MORNING_END_VALUE : undefined}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="approve-end">שעת סיום</Label>
            <Input
              id="approve-end"
              type="time"
              dir="ltr"
              lang="he-IL"
              step={60}
              min={isMorning ? MORNING_START_VALUE : undefined}
              max={isMorning ? MORNING_END_VALUE : undefined}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {timesChanged && (
          <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
            השעות שונו מהבקשה המקורית ({requestedStart}–{requestedEnd}). האישור
            יחיל את השעות שערכת.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="approve-note">הערה (לא חובה)</Label>
          <Textarea
            id="approve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="הערה למאמן (תוצג למאמן)"
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
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 me-2" />
            )}
            אשר
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
