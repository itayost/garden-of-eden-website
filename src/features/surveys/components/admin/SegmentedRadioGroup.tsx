"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SegmentedRadioGroupProps<T extends string> {
  /** The group's accessible name. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (option: T) => void;
  /** What each segment shows. */
  renderOption: (option: T) => ReactNode;
  /** Layout of the group: inline, or full width on a phone. */
  className?: string;
  /** Added to every segment. */
  itemClassName?: string;
}

/** A row of segments of which exactly one is chosen, as a radio group; the chosen one lifts off the track. */
export function SegmentedRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  renderOption,
  className,
  itemClassName,
}: SegmentedRadioGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("gap-0.5 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            value === option && "bg-card text-foreground shadow-sm",
            itemClassName,
          )}
        >
          {renderOption(option)}
        </button>
      ))}
    </div>
  );
}
