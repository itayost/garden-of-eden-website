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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminCreateShiftAction,
  adminEditShiftAction,
} from "@/lib/actions/trainer-shifts";
import type { TrainerShift } from "@/types/database";

export interface ShiftFormTrainer {
  id: string;
  name: string;
}

interface ShiftFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: ShiftFormTrainer[];
  editShift?: TrainerShift;
}

function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTime(isoStr: string): string {
  const d = new Date(isoStr);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ShiftFormDialog({
  open,
  onOpenChange,
  trainers,
  editShift,
}: ShiftFormDialogProps) {
  const router = useRouter();
  const isEdit = !!editShift;

  const [trainerId, setTrainerId] = useState(editShift?.trainer_id ?? "");
  const [date, setDate] = useState(
    editShift ? toLocalDate(editShift.start_time) : ""
  );
  const [startTime, setStartTime] = useState(
    editShift ? toLocalTime(editShift.start_time) : ""
  );
  const [endTime, setEndTime] = useState(
    editShift?.end_time ? toLocalTime(editShift.end_time) : ""
  );
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    if (!isEdit) {
      setTrainerId("");
      setDate("");
      setStartTime("");
      setEndTime("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit && !trainerId) {
      toast.error("יש לבחור מאמן");
      return;
    }
    if (!date || !startTime || !endTime) {
      toast.error("יש למלא את כל השדות");
      return;
    }

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);

    // Handle overnight shifts (e.g. 22:00 → 02:00)
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    setLoading(true);
    try {
      const result = isEdit
        ? await adminEditShiftAction({
            shiftId: editShift.id,
            startTime: startISO,
            endTime: endISO,
          })
        : await adminCreateShiftAction({
            trainerId,
            startTime: startISO,
            endTime: endISO,
          });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "המשמרת עודכנה בהצלחה" : "המשמרת נוצרה בהצלחה");
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת משמרת");
    } finally {
      setLoading(false);
    }
  };

  const trainerLabel = isEdit
    ? trainers.find((t) => t.id === editShift.trainer_id)?.name ??
      editShift.trainer_name
    : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת משמרת" : "משמרת חדשה"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "עדכון שעות התחלה וסיום של המשמרת"
              : "הוספת משמרת ידנית למאמן"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit ? (
            <div className="space-y-2">
              <Label>מאמן</Label>
              <Input value={trainerLabel ?? ""} disabled />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>מאמן *</Label>
              <Select value={trainerId} onValueChange={setTrainerId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מאמן" />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="shift-date">תאריך *</Label>
            <Input
              id="shift-date"
              type="date"
              dir="ltr"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift-start">שעת התחלה *</Label>
              <Input
                id="shift-start"
                type="time"
                dir="ltr"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-end">שעת סיום *</Label>
              <Input
                id="shift-end"
                type="time"
                dir="ltr"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
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
              {isEdit ? "עדכן" : "צור משמרת"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
