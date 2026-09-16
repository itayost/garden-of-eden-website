"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 6;

interface TraineeSearchProps {
  /** Prefix for element ids; the input is `${idPrefix}-search` for a Label. */
  idPrefix: string;
  options: TrainerOption[];
  /** Linked trainees already on the roster, never suggested again. */
  excludeIds: ReadonlySet<string>;
  onPickLinked: (trainee: TrainerOption) => void;
  /** A typed name with no account. The parent decides whether it is a duplicate. */
  onPickFreeText: (name: string) => void;
  disabled?: boolean;
}

/**
 * Trainee combobox with a free-text fallback, shared by the slot form and the
 * calendar's roster sheet. Eden's lists include kids not yet in the system, so
 * a name that matches no account is still a valid entry.
 */
export function TraineeSearch({
  idPrefix,
  options,
  excludeIds,
  onPickLinked,
  onPickFreeText,
  disabled = false,
}: TraineeSearchProps) {
  const [search, setSearch] = useState("");
  // Keyboard highlight over the suggestion list; -1 = nothing highlighted.
  const [highlighted, setHighlighted] = useState(-1);
  const listboxId = `${idPrefix}-suggestions`;

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return options
      .filter((t) => !excludeIds.has(t.id) && (t.full_name ?? "").toLowerCase().includes(term))
      .slice(0, MAX_SUGGESTIONS);
  }, [search, options, excludeIds]);

  const reset = () => {
    setSearch("");
    setHighlighted(-1);
  };

  const pickLinked = (trainee: TrainerOption) => {
    onPickLinked(trainee);
    reset();
  };

  const pickFreeText = () => {
    const name = search.trim();
    if (!name) return;
    onPickFreeText(name);
    reset();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-search`}
          value={search}
          disabled={disabled}
          placeholder="חיפוש מתאמן או שם חופשי..."
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? listboxId : undefined}
          aria-activedescendant={
            highlighted >= 0 && suggestions[highlighted]
              ? `${idPrefix}-option-${suggestions[highlighted].id}`
              : undefined
          }
          onChange={(event) => {
            setSearch(event.target.value);
            setHighlighted(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((h) => Math.max(h - 1, -1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              // A highlighted suggestion wins; otherwise a single match is
              // unambiguous; otherwise the text is a free-text name.
              if (highlighted >= 0 && suggestions[highlighted]) {
                pickLinked(suggestions[highlighted]);
              } else if (suggestions.length === 1) {
                pickLinked(suggestions[0]);
              } else {
                pickFreeText();
              }
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={pickFreeText}
          disabled={disabled || !search.trim()}
          aria-label="הוספת שם חופשי"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div id={listboxId} role="listbox" aria-label="הצעות מתאמנים" className="rounded-md border">
          {suggestions.map((trainee, index) => (
            <button
              key={trainee.id}
              id={`${idPrefix}-option-${trainee.id}`}
              role="option"
              aria-selected={index === highlighted}
              type="button"
              onClick={() => pickLinked(trainee)}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
                index === highlighted ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-bold text-forest">
                {(trainee.full_name ?? "?").slice(0, 1)}
              </span>
              {trainee.full_name ?? "ללא שם"}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        שם שלא נמצא במערכת נוסף כטקסט חופשי (מסומן במסגרת).
      </p>
    </div>
  );
}
