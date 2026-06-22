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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setShiftOtherPurposeAction } from "@/lib/actions/trainer-shifts";
import { SHIFT_OTHER_PURPOSE_CATEGORIES } from "@/lib/constants/shifts";
import { splitShiftMinutes } from "@/lib/utils/shift-other-purpose";
import type { TrainerShift } from "@/types/database";

const CLEAR_VALUE = "__none__";
const MINUTE_PRESETS = [15, 30, 45, 60, 90] as const;

interface ShiftOtherPurposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: TrainerShift;
}

export function ShiftOtherPurposeDialog({
  open,
  onOpenChange,
  shift,
}: ShiftOtherPurposeDialogProps) {
  const router = useRouter();
  const { grossMinutes } = splitShiftMinutes({
    start_time: shift.start_time,
    end_time: shift.end_time,
    other_purpose_minutes: 0,
  });

  const [category, setCategory] = useState<string>(
    shift.other_purpose_category ?? CLEAR_VALUE,
  );
  const [minutes, setMinutes] = useState<string>(
    shift.other_purpose_minutes ? String(shift.other_purpose_minutes) : "",
  );
  const [loading, setLoading] = useState(false);

  const isClear = category === CLEAR_VALUE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMinutes = isClear ? 0 : Number(minutes);
    if (!isClear && (!Number.isInteger(parsedMinutes) || parsedMinutes <= 0)) {
      toast.error("יש להזין משך זמן בדקות");
      return;
    }
    if (!isClear && parsedMinutes > grossMinutes) {
      toast.error("הזמן למטרות אחרות חורג ממשך המשמרת");
      return;
    }

    setLoading(true);
    try {
      const result = await setShiftOtherPurposeAction({
        shiftId: shift.id,
        minutes: parsedMinutes,
        category: isClear ? null : category,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("עודכן");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>זמן למטרות אחרות</DialogTitle>
          <DialogDescription>
            כמה מזמן המשמרת ({grossMinutes} דקות) הוקדש לפעילות שאינה אימון.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <Select value={category} onValueChange={setCategory} dir="rtl">
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLEAR_VALUE}>ללא / נקה</SelectItem>
                {SHIFT_OTHER_PURPOSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isClear && (
            <div className="space-y-2">
              <Label htmlFor="other-minutes">דקות</Label>
              <div className="flex flex-wrap gap-1.5">
                {MINUTE_PRESETS.filter((p) => p <= grossMinutes).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={Number(minutes) === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMinutes(String(p))}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Input
                id="other-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={grossMinutes}
                dir="ltr"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="דקות"
              />
            </div>
          )}

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
              שמור
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
