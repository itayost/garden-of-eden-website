"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NOTE_MAX, QUICK_TAGS, type QuickTagKey, type TraineeTags } from "../lib/tags";

interface QuickTagChipsProps {
  value: TraineeTags | undefined;
  onToggle: (tag: QuickTagKey) => void;
  onSaveNote: (note: string) => void;
  disabled?: boolean;
  /** For the note's accessible name. */
  traineeName: string;
}

const positive = QUICK_TAGS.filter((tag) => tag.kind === "positive");
const caution = QUICK_TAGS.filter((tag) => tag.kind === "caution");

/**
 * The tag chips under one Roster row: the six positive tags, then the two
 * staff-only caution tags, then the one short note.
 */
export function QuickTagChips({ value, onToggle, onSaveNote, disabled, traineeName }: QuickTagChipsProps) {
  const chosen = new Set(value?.tags ?? []);
  const [note, setNote] = useState(value?.note ?? "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {positive.map((tag) => (
          <button
            key={tag.key}
            type="button"
            aria-pressed={chosen.has(tag.key)}
            onClick={() => onToggle(tag.key)}
            disabled={disabled}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm transition-colors disabled:opacity-60",
              chosen.has(tag.key)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-black/10 hover:bg-muted/60",
            )}
          >
            {tag.label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        {caution.map((tag) => (
          <button
            key={tag.key}
            type="button"
            aria-pressed={chosen.has(tag.key)}
            onClick={() => onToggle(tag.key)}
            disabled={disabled}
            title="לצוות בלבד"
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm transition-colors disabled:opacity-60",
              chosen.has(tag.key)
                ? "border-warning bg-warning/20 font-bold text-warning-emphasis"
                : "border-warning/40 text-warning-emphasis hover:bg-warning/10",
            )}
          >
            {tag.label}
          </button>
        ))}
      </div>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => onSaveNote(note)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        maxLength={NOTE_MAX}
        disabled={disabled}
        placeholder="הערה קצרה (למשל: בעיטה ברגל שמאל)"
        aria-label={`הערה קצרה על ${traineeName}`}
        className="h-10 text-sm"
      />
    </div>
  );
}
