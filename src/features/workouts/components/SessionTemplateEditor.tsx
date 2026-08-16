"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionRowsEditor } from "@/components/admin/schedule/SessionRowsEditor";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type { WorkoutExercise } from "@/features/workouts/lib/types";
import { updateTemplateAction } from "@/lib/actions/session-templates";
import {
  exerciseToBuilderRow,
  rowsToExerciseInput,
  templateToBuilderRows,
} from "@/lib/utils/session-import";
import { MAX_EXERCISES_PER_SESSION } from "@/lib/validations/training-session";
import type { SessionTemplate } from "@/types/session-template";
import type { SessionBuilderRow } from "@/types/training-session";

interface SessionTemplateEditorProps {
  template: SessionTemplate;
}

/**
 * Edits a saved template in place.
 *
 * Reuses SessionRowsEditor so a template row and a session row are literally
 * the same control — the whole point of the feature is that what you save is
 * what you get back.
 */
export function SessionTemplateEditor({ template }: SessionTemplateEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [rows, setRows] = useState<SessionBuilderRow[]>(() =>
    templateToBuilderRows(template),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const backHref = "/admin/workouts/templates";

  /**
   * Reads `rows` from the render rather than a setRows updater: it toasts, and
   * React may call an updater more than once, which would fire the toast
   * twice. The picker confirm is a user event, so `rows` is current.
   */
  const addExercises = (exercises: WorkoutExercise[]) => {
    const room = MAX_EXERCISES_PER_SESSION - rows.length;
    const incoming = exercises.map((exercise, index) =>
      exerciseToBuilderRow(
        exercise,
        `new-${exercise.id}-${rows.length + index}-${Date.now()}`,
      ),
    );
    if (incoming.length > room) {
      toast.error(
        `אפשר עד ${MAX_EXERCISES_PER_SESSION} תרגילים בתבנית — ${incoming.length - Math.max(room, 0)} לא נוספו`,
      );
    }
    if (room <= 0) return;
    setRows([...rows, ...incoming.slice(0, room)]);
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast.error("יש להוסיף לפחות תרגיל אחד");
      return;
    }
    setSaving(true);
    try {
      const result = await updateTemplateAction({
        id: template.id,
        name,
        description,
        exercises: rowsToExerciseInput(rows),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("התבנית נשמרה");
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת התבנית");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">עריכת תבנית</h1>
          <p className="text-sm text-muted-foreground">
            נוצרה על ידי {template.created_by_name}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowRight className="me-2 h-4 w-4" />
            חזרה לתבניות
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-name">שם התבנית</Label>
          <Input
            id="template-name"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-description">תיאור (לא חובה)</Label>
          <Input
            id="template-description"
            value={description}
            maxLength={300}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          הוספת תרגילים
        </Button>
      </div>

      <SessionRowsEditor
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="אין תרגילים בתבנית — הוסף מהמאגר."
      />

      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-forest font-bold hover:bg-forest-light md:px-8"
          onClick={handleSave}
          disabled={saving || rows.length === 0 || !name.trim()}
        >
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          שמירת התבנית
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercises}
        alreadyAddedIds={rows.map((row) => row.exerciseId)}
      />
    </div>
  );
}
