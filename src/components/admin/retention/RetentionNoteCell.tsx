"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChurnedColorPicker } from "./ChurnedColorPicker";
import type { NoteColor } from "@/lib/validations/churned-customers";

interface RetentionNoteCellProps {
  note: string;
  noteColor: NoteColor;
  onSave: (note: string, noteColor: NoteColor) => Promise<void>;
}

export function RetentionNoteCell({
  note,
  noteColor,
  onSave,
}: RetentionNoteCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(note);
  const [color, setColor] = useState<NoteColor>(noteColor);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(note);
  }, [note]);

  useEffect(() => {
    setColor(noteColor);
  }, [noteColor]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === note && color === noteColor) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(value, color);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleColorChange = async (next: NoteColor) => {
    setColor(next);
    if (isEditing) return;
    if (next === noteColor) return;
    setIsSaving(true);
    try {
      await onSave(note, next);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setValue(note);
      setColor(noteColor);
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
          rows={3}
          className="text-sm resize-none"
          disabled={isSaving}
        />
        <div className="flex items-center justify-between gap-1">
          <ChurnedColorPicker
            value={color}
            onChange={setColor}
            disabled={isSaving}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue(note);
                setColor(noteColor);
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
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 min-w-[160px]">
      <ChurnedColorPicker
        value={color}
        onChange={handleColorChange}
        disabled={isSaving}
      />
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={note ? "ערוך הערה" : "הוסף הערה"}
        className="flex-1 text-sm text-right cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
      >
        {note ? (
          <span className="block whitespace-pre-wrap break-words max-w-[300px]">
            {note}
          </span>
        ) : (
          <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </button>
    </div>
  );
}
