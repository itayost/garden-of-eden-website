"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionRowsEditor } from "@/components/admin/schedule/SessionRowsEditor";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type { WorkoutExercise } from "@/features/workouts/lib/types";
import {
  clearSlotWorkoutAction,
  saveSlotWorkoutAction,
} from "@/lib/actions/slot-workout";
import { CALENDAR_PATH } from "@/lib/navigation/calendar-views";
import { describeFanout } from "@/lib/schedule/slot-workout-fanout";
import { trainerNames } from "@/lib/utils/trainer-color";
import {
  exerciseToBuilderRow,
  rowsToExerciseInput,
  slotWorkoutToBuilderRows,
} from "@/lib/utils/session-import";
import { formatDate } from "@/lib/utils/date";
import { MAX_EXERCISES_PER_SESSION } from "@/lib/validations/training-session";
import type { SlotWorkout } from "@/types/schedule";
import type { SessionBuilderRow } from "@/types/training-session";

interface SlotWorkoutEditorProps {
  workout: SlotWorkout;
  branchId: string | null;
}

/**
 * The workout everyone booked into one hour does.
 *
 * Saving is also the fan-out, so there is one button and no separate apply
 * step: a saved group workout that reached nobody is the state this whole
 * feature exists to avoid. Clearing the list removes the workout and takes
 * back the sessions it wrote, which is why an empty list asks for confirmation
 * here instead of being refused the way the individual builder refuses it.
 *
 * Every row control comes from SessionRowsEditor and ExercisePicker: a group
 * row, a session row and a template row are literally the same control, and a
 * second copy would drift.
 */
export function SlotWorkoutEditor({ workout, branchId }: SlotWorkoutEditorProps) {
  const router = useRouter();
  const { slot, rosterCount } = workout;
  const [notes, setNotes] = useState(slot.workout_notes_he ?? "");
  const [rows, setRows] = useState<SessionBuilderRow[]>(() =>
    slotWorkoutToBuilderRows(workout),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const time = slot.start_time.slice(0, 5);
  const backHref = `${CALENDAR_PATH}?date=${slot.schedule_date}${branchId ? `&branch=${branchId}` : ""}`;
  const hadWorkout = slot.workout_updated_at !== null;

  /**
   * Reads `rows` from the render rather than a setRows updater: it toasts, and
   * React may call an updater more than once. The picker confirm is a user
   * event, so `rows` is current. Same idiom as SessionTemplateEditor.
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
        `אפשר עד ${MAX_EXERCISES_PER_SESSION} תרגילים באימון — ${incoming.length - Math.max(room, 0)} לא נוספו`,
      );
    }
    if (room <= 0) return;
    setRows([...rows, ...incoming.slice(0, room)]);
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      setClearOpen(true);
      return;
    }
    setSaving(true);
    try {
      const result = await saveSlotWorkoutAction({
        slotId: slot.id,
        notes,
        exercises: rowsToExerciseInput(rows),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(describeFanout(result.data.counts));
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת האימון הקבוצתי");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const result = await clearSlotWorkoutAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.removed === 0
          ? "האימון הקבוצתי נמחק"
          : `האימון הקבוצתי נמחק והוסר מ-${result.data.removed} מתאמנים`,
      );
      setClearOpen(false);
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת האימון הקבוצתי");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">אימון קבוצתי</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(slot.schedule_date)} בשעה {time}
            {trainerNames(slot.trainers) ? ` · ${trainerNames(slot.trainers)}` : ""}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowRight className="me-2 h-4 w-4" />
            חזרה ליומן
          </Link>
        </Button>
      </div>

      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        {rosterCount === 0
          ? "אין רשומים לסלוט. האימון יישמר ויינתן לכל מי שיירשם."
          : rosterCount === 1
            ? "השמירה תשלח את האימון למתאמן אחד הרשום לסלוט."
            : `השמירה תשלח את האימון ל-${rosterCount} הרשומים לסלוט.`}
      </p>

      <div className="space-y-2">
        <Label htmlFor="slot-workout-notes">הערות לאימון (לא חובה)</Label>
        <Input
          id="slot-workout-notes"
          value={notes}
          maxLength={300}
          onChange={(event) => setNotes(event.target.value)}
        />
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
        emptyMessage="אין תרגילים באימון הקבוצתי — הוסף מהמאגר."
      />

      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-forest font-bold hover:bg-forest-light md:px-8"
          onClick={handleSave}
          disabled={saving || (rows.length === 0 && !hadWorkout)}
        >
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {rows.length === 0 ? "מחיקת האימון הקבוצתי" : "שמירה ושליחה לקבוצה"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercises}
        alreadyAddedIds={rows.map((row) => row.exerciseId)}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת האימון הקבוצתי</AlertDialogTitle>
            <AlertDialogDescription>
              האימון של {time} יימחק, ויוסר מהמתאמנים שקיבלו אותו. אימון שמאמן
              ערך למתאמן בודד, ואימון שכבר הושלם, יישארו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleClear();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "מוחק..." : "מחיקה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
