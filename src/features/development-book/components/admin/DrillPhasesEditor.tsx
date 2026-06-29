"use client";

import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RepeatableRows } from "./RepeatableRows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhasePointRow extends Record<string, unknown> {
  text_he: string;
}

export interface PhaseRow {
  number: string;
  name_he: string;
  subtitle_he: string;
  drill_note_he: string;
  points: PhasePointRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newPhaseRow(): PhaseRow {
  return {
    number: "",
    name_he: "",
    subtitle_he: "",
    drill_note_he: "",
    points: [],
  };
}

function newPointRow(): PhasePointRow {
  return { text_he: "" };
}

const POINT_COLUMNS = [
  { key: "text_he" as const, labelHe: "טקסט נקודה" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DrillPhasesEditorProps {
  phases: PhaseRow[];
  onChange: (phases: PhaseRow[]) => void;
}

export function DrillPhasesEditor({ phases, onChange }: DrillPhasesEditorProps) {
  function handleAdd() {
    onChange([...phases, newPhaseRow()]);
  }

  function handleDelete(index: number) {
    onChange(phases.filter((_, i) => i !== index));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const next = [...phases];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function handleMoveDown(index: number) {
    if (index === phases.length - 1) return;
    const next = [...phases];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function handleFieldChange(index: number, field: keyof PhaseRow, value: unknown) {
    onChange(
      phases.map((phase, i) =>
        i === index ? { ...phase, [field]: value } : phase
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {phases.map((phase, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 space-y-4 bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              שלב {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                aria-label="הזז למעלה"
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleMoveDown(index)}
                disabled={index === phases.length - 1}
                aria-label="הזז למטה"
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(index)}
                aria-label="מחק שלב"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`phase-number-${index}`}>מספר שלב</Label>
              <Input
                id={`phase-number-${index}`}
                type="number"
                value={phase.number}
                onChange={(e) => handleFieldChange(index, "number", e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`phase-name-${index}`}>שם שלב</Label>
              <Input
                id={`phase-name-${index}`}
                value={phase.name_he}
                onChange={(e) => handleFieldChange(index, "name_he", e.target.value)}
                placeholder="שם השלב"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`phase-subtitle-${index}`}>כותרת משנה</Label>
            <Input
              id={`phase-subtitle-${index}`}
              value={phase.subtitle_he}
              onChange={(e) => handleFieldChange(index, "subtitle_he", e.target.value)}
              placeholder="כותרת משנה לשלב"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`phase-drill-note-${index}`}>הערת תרגיל</Label>
            <Textarea
              id={`phase-drill-note-${index}`}
              value={phase.drill_note_he}
              onChange={(e) => handleFieldChange(index, "drill_note_he", e.target.value)}
              rows={2}
              placeholder="הערה לתרגיל בשלב זה"
            />
          </div>

          <div className="space-y-2">
            <Label>נקודות שלב</Label>
            <RepeatableRows<PhasePointRow>
              rows={phase.points}
              columns={POINT_COLUMNS}
              onChange={(pts) => handleFieldChange(index, "points", pts)}
              newRow={newPointRow}
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="self-start"
      >
        <Plus className="size-4 ms-1" />
        הוסף שלב
      </Button>
    </div>
  );
}
