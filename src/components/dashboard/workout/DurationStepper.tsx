"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/utils/performance-profile";
import { MEASURE_BOUNDS } from "@/lib/validations/measures";

interface DurationStepperProps {
  id: string;
  label: string;
  /** Seconds as a string, "" when empty — same contract as StepperInput. */
  value: string;
  onChange: (value: string) => void;
  /** Seconds added or removed per tap. */
  step?: number;
  max?: number;
}

/**
 * Time as mm:ss with thumb-sized −/+ taps.
 *
 * Deliberately not a text field: a kid mid-plank is not typing "01:30", and a
 * free-text duration invites "1 minute 30" that nothing can parse. The value
 * stays plain seconds; only the display is formatted.
 */
export function DurationStepper({
  id,
  label,
  value,
  onChange,
  step = 15,
  max = MEASURE_BOUNDS.durationSeconds.max,
}: DurationStepperProps) {
  const seconds = value === "" ? null : Number(value);
  const current = seconds === null || Number.isNaN(seconds) ? 0 : seconds;

  const nudge = (delta: number) => {
    const next = Math.min(Math.max(current + delta, 0), max);
    onChange(next === 0 ? "" : String(next));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          onClick={() => nudge(-step)}
          aria-label={`הפחתת ${label}`}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <output
          id={id}
          aria-live="polite"
          className="w-20 text-center text-2xl font-extrabold tabular-nums"
        >
          {value === "" ? "00:00" : formatDuration(current)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          onClick={() => nudge(step)}
          aria-label={`הוספת ${label}`}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
