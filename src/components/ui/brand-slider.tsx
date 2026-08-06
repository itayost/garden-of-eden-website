"use client";

import { cn } from "@/lib/utils";

interface BrandSliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "min" | "max" | "step" | "type" | "className"
  > {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Labels for the two ends, e.g. "קל מאוד" / "קשה מאוד". */
  startLabel?: string;
  endLabel?: string;
  className?: string;
}

/**
 * A styled range input: grass-to-gold fill, thumb sized for a kid's finger,
 * the live value huge above the track. Still a native input[type=range]
 * underneath, so keyboard/VoiceOver behavior is the platform's.
 */
export function BrandSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  startLabel,
  endLabel,
  className,
  ...rest
}: BrandSliderProps) {
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn("space-y-1", className)}>
      <p
        aria-hidden="true"
        className="text-center text-4xl font-extrabold text-forest tabular-nums"
      >
        {value}
      </p>
      <div className="relative flex h-7 items-center">
        {/* Track + fill drawn under the transparent native input. */}
        <div className="absolute inset-x-0 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-l from-grass to-gold"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {/* rest carries FormControl's injected id/aria-describedby/aria-invalid
            through to the actual input, so FormLabel and FormDescription wire
            to the element a screen reader lands on. */}
        <input
          {...rest}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(
            "relative w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
            // WebKit thumb
            "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-gold [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md",
            // Firefox thumb
            "[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-gold [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md",
            "[&::-moz-range-track]:bg-transparent",
          )}
        />
      </div>
      {(startLabel || endLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}
