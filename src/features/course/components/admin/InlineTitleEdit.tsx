"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface InlineTitleEditProps {
  value: string;
  /** True while the value is a generated placeholder, not a real title. */
  isPlaceholder?: boolean;
  /** Saves the new title. Returns an error message, or null on success. */
  onSave: (next: string) => Promise<string | null>;
  className?: string;
  inputClassName?: string;
  label: string;
}

/**
 * Click-to-edit title. Used everywhere in the course CMS because filling in the
 * 22 placeholder titles is the main job this screen exists for, and a dialog per
 * rename would make that tedious.
 */
export function InlineTitleEdit({
  value,
  isPlaceholder = false,
  onSave,
  className,
  inputClassName,
  label,
}: InlineTitleEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  const commit = () => {
    const next = draft.trim();
    if (next.length === 0) {
      toast.error("נדרשת כותרת");
      return;
    }
    // An unchanged title is only a no-op once the row has a real name. While the
    // value is still a generated placeholder the save is what clears
    // `needs_title`, so confirming the placeholder text as the real title (Eden
    // may well want "פרק 1" verbatim) has to go through to the server -- else the
    // row stays flagged and unpublishable with nothing on screen explaining why.
    if (next === value && !isPlaceholder) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const error = await onSave(next);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("נשמר");
      setEditing(false);
    });
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") cancel();
          }}
          disabled={pending}
          aria-label={label}
          className={cn("h-8", inputClassName)}
        />
        <button
          type="button"
          onClick={commit}
          disabled={pending}
          aria-label="שמור"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-primary hover:bg-muted disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          aria-label="בטל"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-start hover:bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate",
          isPlaceholder && "italic text-muted-foreground"
        )}
      >
        {value}
        {isPlaceholder && " — חסר שם"}
      </span>
      <Pencil
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}
