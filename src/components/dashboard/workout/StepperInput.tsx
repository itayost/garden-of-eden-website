"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepperInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  /** "numeric" for whole numbers, "decimal" for weights. */
  inputMode?: "numeric" | "decimal";
}

/**
 * A number field a kid can operate mid-set with a thumb: large −/+ targets
 * (44px minimum) flanking a big centered value. Typing stays possible — the
 * steppers are the fast path, not the only path.
 */
export function StepperInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  inputMode = "numeric",
}: StepperInputProps) {
  const numeric = value === "" ? null : Number(value);

  const nudge = (delta: number) => {
    const base = numeric === null || Number.isNaN(numeric) ? 0 : numeric;
    const next = Math.min(Math.max(base + delta, min), max);
    // Avoid float artifacts on decimal steps (22.5 + 2.5).
    onChange(String(Math.round(next * 100) / 100));
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
        <Input
          id={id}
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-16 border-0 bg-transparent text-center text-2xl font-extrabold tabular-nums shadow-none focus-visible:ring-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
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
