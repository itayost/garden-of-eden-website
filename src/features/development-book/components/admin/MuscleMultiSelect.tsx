"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BookMuscle } from "@/features/development-book/lib/types";

interface MuscleMultiSelectProps {
  muscles: BookMuscle[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Compact dropdown multi-select for picking the muscles a drill works.
// The trigger stays small inside the drills grid cell; the searchable
// checkbox list lives in a popover so it does not bloat the row.
export function MuscleMultiSelect({
  muscles,
  selected,
  onChange,
}: MuscleMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return muscles;
    return muscles.filter((m) => m.nameHe.toLowerCase().includes(term));
  }, [muscles, search]);

  const label = useMemo(() => {
    if (selected.length === 0) return "בחר שרירים";
    return muscles
      .filter((m) => selected.includes(m.id))
      .map((m) => m.nameHe)
      .join(", ");
  }, [muscles, selected]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[120px] justify-between gap-2 font-normal"
        >
          <span className="truncate text-start">
            {label}
            {selected.length > 0 && (
              <span className="text-muted-foreground"> ({selected.length})</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" dir="rtl">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש שריר..."
          className="mb-2"
        />
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              לא נמצאו שרירים
            </p>
          ) : (
            filtered.map((muscle) => (
              <label
                key={muscle.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(muscle.id)}
                  onCheckedChange={() => toggle(muscle.id)}
                />
                <span>{muscle.nameHe}</span>
                {muscle.emoji && <span aria-hidden="true">{muscle.emoji}</span>}
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
