"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MORNING_SHIFT_END_HOUR,
  MORNING_SHIFT_START_HOUR,
  SHIFT_PERIODS,
  SHIFT_PERIOD_LABELS,
  type ShiftPeriod,
} from "@/lib/constants/shifts";

/** "08:00" / "11:00" — the morning window bounds as <input type="time"> values. */
export const MORNING_START_VALUE = `${String(MORNING_SHIFT_START_HOUR).padStart(2, "0")}:00`;
export const MORNING_END_VALUE = `${String(MORNING_SHIFT_END_HOUR).padStart(2, "0")}:00`;

/**
 * Builds the start/end timestamps for a shift form.
 *
 * Regular shifts may run overnight (22:00 -> 02:00), so an end at or before
 * the start rolls to the next day. Morning shifts are confined to a single
 * Israel day, where that bump could only ever produce an invalid request.
 */
export function buildShiftRange(
  date: string,
  startTime: string,
  endTime: string,
  period: ShiftPeriod
): { start: Date; end: Date } {
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (period !== "morning" && end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

interface ShiftPeriodSelectProps {
  id?: string;
  value: ShiftPeriod;
  onChange: (period: ShiftPeriod) => void;
  disabled?: boolean;
}

export function ShiftPeriodSelect({
  id = "shift-period",
  value,
  onChange,
  disabled,
}: ShiftPeriodSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>סוג משמרת *</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as ShiftPeriod)}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SHIFT_PERIODS.map((period) => (
            <SelectItem key={period} value={period}>
              {SHIFT_PERIOD_LABELS[period]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "morning" && (
        <p className="text-xs text-muted-foreground">
          משמרת בוקר מוגבלת לשעות {MORNING_START_VALUE}-{MORNING_END_VALUE}
        </p>
      )}
    </div>
  );
}
