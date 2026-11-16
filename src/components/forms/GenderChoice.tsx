"use client";

import { cn } from "@/lib/utils";
import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/profile/gender";

interface GenderChoiceProps {
  value: Gender | "" | undefined;
  onChange: (next: Gender) => void;
  disabled?: boolean;
  /** Keeps ids unique when a page holds more than one form. */
  idPrefix: string;
}

/** The בן / בת choice of /join, the signing page and the staff user form. */
export function GenderChoice({ value, onChange, disabled, idPrefix }: GenderChoiceProps) {
  return (
    <div className="grid grid-cols-2 gap-3" role="group">
      {GENDERS.map((option) => {
        const chosen = value === option;
        return (
          <button
            key={option}
            id={`${idPrefix}-${option}`}
            type="button"
            aria-pressed={chosen}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-12 rounded-xl border p-3 text-base font-medium transition-colors disabled:opacity-60",
              chosen
                ? "border-primary bg-primary text-primary-foreground"
                : "border-black/10 hover:bg-muted/60",
            )}
          >
            {GENDER_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
