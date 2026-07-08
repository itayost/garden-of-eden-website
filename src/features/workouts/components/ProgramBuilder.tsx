"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Plus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveProgram } from "@/features/workouts/lib/actions";
import { resizeRowCells } from "@/features/workouts/lib/grid-utils";
import { ProgramGrid } from "@/features/workouts/components/ProgramGrid";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type {
  ProgramGrid as ProgramGridType,
  ProgramExerciseRow,
  WorkoutExercise,
  WorkoutProgram,
} from "@/features/workouts/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgramMeta {
  name: string;
  description: string;
  weeks: number;
  periodizationType: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metaFromProgram(program: WorkoutProgram): ProgramMeta {
  return {
    name: program.name,
    description: program.description ?? "",
    weeks: program.weeks,
    periodizationType: program.periodizationType ?? "",
  };
}

// ---------------------------------------------------------------------------
// ProgramBuilder
// ---------------------------------------------------------------------------

interface ProgramBuilderProps {
  programId: string;
  initialGrid: ProgramGridType;
}

export function ProgramBuilder({ programId, initialGrid }: ProgramBuilderProps) {
  const [meta, setMeta] = useState<ProgramMeta>(
    metaFromProgram(initialGrid.program)
  );
  const [rows, setRows] = useState<ProgramExerciseRow[]>(initialGrid.rows);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, startSave] = useTransition();

  // When weeks changes: resize every row's cells immutably.
  const handleWeeksChange = (newWeeks: number) => {
    // Ignore empty/invalid input (e.g. the field momentarily cleared mid-edit,
    // which yields 0) so it can't silently truncate every row's later-week cells.
    if (!Number.isFinite(newWeeks) || newWeeks < 1) return;
    const clamped = Math.min(52, Math.trunc(newWeeks));

    // Shrinking the week count truncates every row's later-week cells —
    // confirm with the user before discarding that data.
    if (clamped < meta.weeks) {
      const confirmed = window.confirm(
        "הורדת מספר השבועות תמחק את הנתונים בשבועות שמעבר. להמשיך?"
      );
      if (!confirmed) return;
    }

    setMeta((prev) => ({ ...prev, weeks: clamped }));
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        cells: resizeRowCells(row.cells, clamped),
      }))
    );
  };

  const handleAddExercise = (exercise: WorkoutExercise) => {
    const newRow: ProgramExerciseRow = {
      key: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.nameHe ?? exercise.nameEn ?? "",
      notesHe: "",
      cells: resizeRowCells([], meta.weeks),
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleSave = () => {
    startSave(async () => {
      // Map camelCase client rows -> snake_case ProgramRowsInput
      const snakeRows = rows.map((row) => ({
        exercise_id: row.exerciseId,
        notes_he: row.notesHe || null,
        cells: row.cells.map((cell) => ({
          week: cell.week,
          sets: cell.sets,
          reps_he: cell.repsHe,
          load_he: cell.loadHe,
          notes_he: cell.notesHe,
        })),
      }));

      const result = await saveProgram(
        programId,
        {
          name: meta.name,
          description: meta.description || null,
          weeks: meta.weeks,
          periodization_type: meta.periodizationType || null,
        },
        snakeRows
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("התוכנית נשמרה בהצלחה");
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/workouts/programs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לתוכניות
      </Link>

      {/* Meta editor */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי תוכנית</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="prog-name">שם התוכנית</Label>
              <Input
                id="prog-name"
                value={meta.name}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="שם התוכנית"
                disabled={saving}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="prog-desc">תיאור</Label>
              <Textarea
                id="prog-desc"
                value={meta.description}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="תיאור קצר של התוכנית (אופציונלי)"
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prog-weeks">מספר שבועות</Label>
              <Input
                id="prog-weeks"
                type="number"
                min={1}
                max={52}
                value={meta.weeks}
                onChange={(e) => handleWeeksChange(Number(e.target.value))}
                disabled={saving}
                dir="ltr"
                className="w-28"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prog-period">סוג פריודיזציה</Label>
              <Input
                id="prog-period"
                value={meta.periodizationType}
                onChange={(e) =>
                  setMeta((prev) => ({
                    ...prev,
                    periodizationType: e.target.value,
                  }))
                }
                placeholder="למשל: ליניארית, גלי, בלוק"
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid + actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>
              לוח תרגילים
              {rows.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground me-2">
                  ({rows.length} תרגילים)
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={saving}
            >
              <Plus className="h-4 w-4 ms-1" />
              הוסף תרגיל
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <ProgramGrid
            rows={rows}
            weeks={meta.weeks}
            onRowsChange={setRows}
          />
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-start">
        <Button onClick={handleSave} disabled={saving || !meta.name.trim()}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin ms-2" />
          ) : (
            <Save className="h-4 w-4 ms-2" />
          )}
          שמור
        </Button>
      </div>

      {/* Exercise picker modal */}
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddExercise}
      />
    </div>
  );
}
