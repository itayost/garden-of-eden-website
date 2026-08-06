"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  History,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type { WorkoutExercise, WorkoutProgram } from "@/features/workouts/lib/types";
import {
  deleteSessionAction,
  getPreviousSessionAction,
  upsertSessionAction,
} from "@/lib/actions/training-sessions";
import { formatDate } from "@/lib/utils/date";
import type {
  SessionBuilderRow,
  TrainingSession,
} from "@/types/training-session";
import { CopyFromProgramDialog } from "./CopyFromProgramDialog";

interface SessionBuilderProps {
  traineeId: string;
  traineeName: string;
  /** ISO YYYY-MM-DD — the day this session is for. */
  date: string;
  /** Slot the builder was opened from, recorded on the session. */
  slotId: string | null;
  /** Existing session for this trainee+date, or null when building fresh. */
  session: TrainingSession | null;
  loadError: string | null;
  programs: WorkoutProgram[];
}

function sessionToRows(session: TrainingSession): SessionBuilderRow[] {
  return session.exercises.map((exercise) => ({
    key: exercise.id,
    exerciseId: exercise.exercise_id,
    exerciseName:
      exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל",
    targetSets: exercise.target_sets,
    targetReps: exercise.target_reps_he ?? "",
    targetLoad: exercise.target_load_he ?? "",
    notes: exercise.notes_he ?? "",
  }));
}

export function SessionBuilder({
  traineeId,
  traineeName,
  date,
  slotId,
  session,
  loadError,
  programs,
}: SessionBuilderProps) {
  const router = useRouter();
  const [rows, setRows] = useState<SessionBuilderRow[]>(
    session ? sessionToRows(session) : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  const backHref = `/admin/schedule?date=${date}`;

  // Imports MERGE into the current list rather than replacing it — wiping
  // rows the trainer already tuned would be silent data loss. Exercises
  // already present keep their edited targets; only new ones are appended.
  const mergeRows = (incoming: SessionBuilderRow[]) => {
    setRows((prev) => {
      const existingIds = new Set(prev.map((row) => row.exerciseId));
      const fresh = incoming.filter((row) => !existingIds.has(row.exerciseId));
      return [...prev, ...fresh];
    });
  };

  const updateRow = (key: string, patch: Partial<SessionBuilderRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addExercise = (exercise: WorkoutExercise) => {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${exercise.id}-${prev.length}-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.nameHe ?? exercise.nameEn ?? "תרגיל",
        targetSets: null,
        targetReps: "",
        targetLoad: "",
        notes: "",
      },
    ]);
  };

  const loadPrevious = async () => {
    setLoadingPrevious(true);
    try {
      const result = await getPreviousSessionAction(traineeId, date);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (!result.data) {
        toast.error("אין אימון קודם למתאמן הזה");
        return;
      }
      mergeRows(
        sessionToRows(result.data).map((row, index) => ({
          ...row,
          key: `prev-${row.exerciseId}-${index}`,
        })),
      );
      toast.success(
        `נטען האימון מ-${formatDate(result.data.session_date)} — אפשר לערוך ולשמור`,
      );
    } catch {
      toast.error("שגיאה בטעינת האימון הקודם");
    } finally {
      setLoadingPrevious(false);
    }
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast.error("יש להוסיף לפחות תרגיל אחד");
      return;
    }
    setSaving(true);
    try {
      const result = await upsertSessionAction({
        traineeId,
        sessionDate: date,
        slotId,
        notes: null,
        exercises: rows.map((row) => ({
          exerciseId: row.exerciseId,
          targetSets: row.targetSets,
          targetReps: row.targetReps,
          targetLoad: row.targetLoad,
          notes: row.notes,
        })),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("האימון נשמר");
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת האימון");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      const result = await deleteSessionAction(session.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("האימון נמחק");
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת האימון");
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-destructive">{loadError}</p>
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowRight className="me-2 h-4 w-4" />
              חזרה ללוח
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">אימון עבור {traineeName}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(date)}
            {session ? ` · נבנה על ידי ${session.built_by_name}` : ""}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowRight className="me-2 h-4 w-4" />
            חזרה ללוח
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          הוספת תרגיל
        </Button>
        <Button
          variant="outline"
          onClick={() => setCopyOpen(true)}
          disabled={programs.length === 0}
        >
          <Copy className="me-2 h-4 w-4" />
          העתקה מתוכנית
        </Button>
        <Button variant="outline" onClick={loadPrevious} disabled={loadingPrevious}>
          {loadingPrevious ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <History className="me-2 h-4 w-4" />
          )}
          שכפול אימון קודם
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין תרגילים עדיין — הוסף מהמאגר, העתק מתוכנית או שכפל אימון קודם.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <Card key={row.key}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base">
                  {index + 1}. {row.exerciseName}
                </CardTitle>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                    aria-label="הזזה למעלה"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label="הזזה למטה"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                    aria-label={`הסרת ${row.exerciseName}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`sets-${row.key}`} className="text-xs">
                      סטים
                    </Label>
                    <Input
                      id={`sets-${row.key}`}
                      type="number"
                      min={1}
                      max={99}
                      inputMode="numeric"
                      value={row.targetSets ?? ""}
                      onChange={(event) =>
                        updateRow(row.key, {
                          targetSets:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`reps-${row.key}`} className="text-xs">
                      חזרות
                    </Label>
                    <Input
                      id={`reps-${row.key}`}
                      placeholder="8-10"
                      value={row.targetReps}
                      onChange={(event) =>
                        updateRow(row.key, { targetReps: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`load-${row.key}`} className="text-xs">
                      משקל / עומס
                    </Label>
                    <Input
                      id={`load-${row.key}`}
                      placeholder={'20 ק"ג'}
                      value={row.targetLoad}
                      onChange={(event) =>
                        updateRow(row.key, { targetLoad: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`notes-${row.key}`} className="text-xs">
                      הערה
                    </Label>
                    <Input
                      id={`notes-${row.key}`}
                      value={row.notes}
                      onChange={(event) =>
                        updateRow(row.key, { notes: event.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        {session ? (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="me-2 h-4 w-4" />
            מחיקת האימון
          </Button>
        ) : (
          <span />
        )}

        <Button onClick={handleSave} disabled={saving || rows.length === 0}>
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          שמירת האימון
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercise}
      />

      <CopyFromProgramDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        programs={programs}
        onImport={mergeRows}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת אימון</AlertDialogTitle>
            <AlertDialogDescription>
              האימון של {traineeName} ל-{formatDate(date)} יימחק לצמיתות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "מוחק..." : "מחיקה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
