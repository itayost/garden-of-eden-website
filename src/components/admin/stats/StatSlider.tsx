"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getStatColor } from "@/types/player-stats";

interface StatSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Stat slider with visual feedback based on value
 * Used for player stats in FIFA-style cards
 */
export function StatSlider({
  value,
  onChange,
  label,
  min = 1,
  max = 99,
  step = 1,
}: StatSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm">{label}</span>
        <span className={cn("text-sm font-bold w-8 text-left", getStatColor(value))}>
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}
