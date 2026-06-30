"use client";

import { Input } from "@/components/ui/input";
import type { ProgramCell } from "@/features/workouts/lib/types";

interface GridCellProps {
  cell: ProgramCell;
  onChange: (updated: ProgramCell) => void;
}

export function GridCell({ cell, onChange }: GridCellProps) {
  const update = (patch: Partial<ProgramCell>) => {
    onChange({ ...cell, ...patch });
  };

  return (
    <div className="flex flex-col gap-1 min-w-[110px]">
      <Input
        type="number"
        min={0}
        placeholder="סטים"
        aria-label="מספר סטים"
        value={cell.sets ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          update({ sets: val === "" ? null : Number(val) });
        }}
        className="h-7 text-xs px-1 text-center"
        dir="ltr"
      />
      <Input
        placeholder="חזרות"
        aria-label="חזרות"
        value={cell.repsHe}
        onChange={(e) => update({ repsHe: e.target.value })}
        className="h-7 text-xs px-1"
      />
      <Input
        placeholder="עומס"
        aria-label="עומס"
        value={cell.loadHe}
        onChange={(e) => update({ loadHe: e.target.value })}
        className="h-7 text-xs px-1"
      />
      <Input
        placeholder="הערות תא"
        aria-label="הערות תא"
        value={cell.notesHe}
        onChange={(e) => update({ notesHe: e.target.value })}
        className="h-7 text-xs px-1"
      />
    </div>
  );
}
