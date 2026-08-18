"use client";

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
import { createExceptionAction } from "@/lib/actions/weekly-schedule";
import { type ExceptionKind } from "@/types/weekly-schedule";

interface ExceptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: TrainerOption[];
  /**
   * Seeds the date field. The week view opens this from a dated column, where
   * retyping the date the user just clicked would be absurd.
   */
  defaultDate?: string;
  /**
   * Only admins may write exceptions. The gate is repeated here rather than
   * left to each caller hiding its trigger: two callers now, and a hidden
   * trigger is not a permission.
   */
  canEdit: boolean;
}

/**
 * Records a dated deviation from the standing week: a trainer absent for one
 * date, or a one-off extra. It never edits a Band, so next week is untouched.
 *
 * Create-only, as it always was. There is no edit path for an exception; a
 * wrong one is deleted in the exceptions panel and written again.
 */
export function ExceptionFormDialog({
  open,
  onOpenChange,
  trainers,
  defaultDate,
  canEdit,
}: ExceptionFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<ExceptionKind>("absent");
  const [exceptionDate, setExceptionDate] = useState(defaultDate ?? "");
  const [trainerId, setTrainerId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  const isExtra = kind === "extra";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trainerId) {
      toast.error("יש לבחור מאמן");
      return;
    }

    setLoading(true);
    try {
      const result = await createExceptionAction({
        exceptionDate,
        trainerId,
        kind,
        // An absence covers the whole day, so it must not carry times even if
        // the fields were filled in before the kind was switched.
        startTime: isExtra ? startTime : "",
        endTime: isExtra ? endTime : "",
        location: isExtra ? location : "",
        label: isExtra ? label : "",
        note,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("החריגה נשמרה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת החריגה");
    } finally {
      setLoading(false);
    }
  };

  // Writing an exception is admin-only; a hidden trigger is not a gate.
  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle>חריגה חדשה</DialogTitle>
          <DialogDescription>
            החלפה נרשמת כשתי חריגות: היעדרות של האחד ותוספת של השני.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="space-y-2">
            <Label htmlFor="exception-kind">סוג</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as ExceptionKind)}
            >
              <SelectTrigger id="exception-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absent">
                  היעדרות — המאמן לא מגיע ביום הזה
                </SelectItem>
                <SelectItem value="extra">
                  תוספת חד-פעמית — רצועה נוספת ביום הזה
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-date">תאריך</Label>
            <Input
              id="exception-date"
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-trainer">מאמן</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger id="exception-trainer">
                <SelectValue placeholder="בחירת מאמן" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.full_name ?? "ללא שם"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isExtra && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="exception-start">שעת התחלה</Label>
                  <Input
                    id="exception-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exception-end">שעת סיום</Label>
                  <Input
                    id="exception-end"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exception-location">מיקום (אופציונלי)</Label>
                <Input
                  id="exception-location"
                  value={location}
                  placeholder="לדוגמה: סטודיו"
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exception-label">קבוצה (אופציונלי)</Label>
                <Input
                  id="exception-label"
                  value={label}
                  placeholder="לדוגמה: נערים א׳"
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="exception-note">הערה (אופציונלי)</Label>
            <Input
              id="exception-note"
              value={note}
              placeholder={isExtra ? "לדוגמה: מחליף את לידור" : "לדוגמה: חופשה"}
              onChange={(event) => setNote(event.target.value)}
            />
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
