"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { NoteColor } from "@/lib/validations/churned-customers";

interface ChurnedColorPickerProps {
  readonly value: NoteColor;
  readonly onChange: (color: NoteColor) => void;
  readonly disabled?: boolean;
}

const SWATCHES: ReadonlyArray<{ color: NoteColor; label: string; bg: string; ring: string }> = [
  { color: "none", label: "ללא", bg: "bg-white", ring: "ring-1 ring-inset ring-gray-300" },
  { color: "yellow", label: "צהוב", bg: "bg-yellow-300", ring: "" },
  { color: "red", label: "אדום", bg: "bg-red-400", ring: "" },
  { color: "green", label: "ירוק", bg: "bg-green-400", ring: "" },
];

export function ChurnedColorPicker({
  value,
  onChange,
  disabled,
}: ChurnedColorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = SWATCHES.find((s) => s.color === value) ?? SWATCHES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`צבע הערה: ${current.label}`}
          disabled={disabled}
          className={`h-6 w-6 rounded-full ${current.bg} ${current.ring} disabled:opacity-50`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex items-center gap-2">
          {SWATCHES.map((s) => (
            <Button
              key={s.color}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={s.label}
              className="h-8 w-8 p-0"
              onClick={() => {
                onChange(s.color);
                setOpen(false);
              }}
            >
              <span className={`h-6 w-6 rounded-full ${s.bg} ${s.ring}`} />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
