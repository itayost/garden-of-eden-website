"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RetentionNoteCellProps {
  note: string;
  onSave: (note: string) => Promise<void>;
}

export function RetentionNoteCell({ note, onSave }: RetentionNoteCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(note);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(note);
  }, [note]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === note) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setValue(note);
      setIsEditing(false);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="text-sm resize-none"
          disabled={isSaving}
        />
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(note);
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="h-6 px-2 text-xs"
          >
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-6 px-2 text-xs"
          >
            {isSaving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1 text-sm text-right w-full cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
    >
      {note ? (
        <span className="truncate max-w-[150px]">{note}</span>
      ) : (
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}
