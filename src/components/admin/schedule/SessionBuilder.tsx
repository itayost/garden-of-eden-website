"use client";

import { useMemo, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

/** "3 סטים · 10 חזרות · 20 ק"ג" from the trainee's log, for the staff view. */
function formatLog(log: {
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
}): string {
  const parts: string[] = [];
  if (log.sets) parts.push(`${log.sets} סטים`);
  if (log.reps) parts.push(`${log.reps} חזרות`);
  if (log.weight_kg !== null && log.weight_kg !== undefined)
    parts.push(`${log.weight_kg} ק"ג`);
  return parts.join(" · ");
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

  // What the trainee actually did — keyed by SESSION-EXERCISE id (the row key
  // of existing rows), so two rows of the same library exercise keep their own
  // logs. Logs whose row was removed still render in an aside below the list:
  // deleting a row must not hide what the trainee actually did.
  const logByRowKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const exercise of session?.exercises ?? []) {
      const log = exercise.logs?.[0];
      if (log) map[exercise.id] = formatLog(log);
    }
    return map;
  }, [session]);

  const orphanedLogs = useMemo(() => {
    const rowKeys = new Set(rows.map((row) => row.key));
    return (session?.exercises ?? [])
      .filter((exercise) => (exercise.logs?.length ?? 0) > 0 && !rowKeys.has(exercise.id))
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל",
        line: formatLog(exercise.logs![0]),
      }));
  }, [session, rows]);

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
    // pb-28 clears the sticky action bar on mobile.
    <div className="space-y-6 pb-28 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">
            אימון עבור {traineeName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(date)}
            {session ? ` · נבנה על ידי ${session.built_by_name}` : ""}
            {session?.completed_at ? " · הושלם" : ""}
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
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="rounded-full bg-muted p-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-muted-foreground">
              אין תרגילים עדיין — הוסף מהמאגר, העתק מתוכנית או שכפל אימון קודם.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl py-0">
          <CardContent className="divide-y px-4 py-1">
            {rows.map((row, index) => {
              const loggedLine = logByRowKey[row.key];
              return (
                <div key={row.key} className="group flex items-start gap-3 py-3">
                  <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-extrabold text-cream">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">
                        {row.exerciseName}
                      </p>
                      <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveRow(index, -1)}
                          disabled={index === 0}
                          aria-label="הזזה למעלה"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveRow(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label="הזזה למטה"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setRows((prev) => prev.filter((r) => r.key !== row.key))
                          }
                          aria-label={`הסרת ${row.exerciseName}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <Input
                        id={`sets-${row.key}`}
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        placeholder="סטים"
                        aria-label="סטים"
                        className="h-9"
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
                      <Input
                        id={`reps-${row.key}`}
                        placeholder="חזרות (8-10)"
                        aria-label="חזרות"
                        className="h-9"
                        value={row.targetReps}
                        onChange={(event) =>
                          updateRow(row.key, { targetReps: event.target.value })
                        }
                      />
                      <Input
                        id={`load-${row.key}`}
                        placeholder={'משקל (20 ק"ג)'}
                        aria-label="משקל או עומס"
                        className="h-9"
                        value={row.targetLoad}
                        onChange={(event) =>
                          updateRow(row.key, { targetLoad: event.target.value })
                        }
                      />
                      <Input
                        id={`notes-${row.key}`}
                        placeholder="הערה"
                        aria-label="הערה"
                        className="h-9"
                        value={row.notes}
                        onChange={(event) =>
                          updateRow(row.key, { notes: event.target.value })
                        }
                      />
                    </div>

                    {loggedLine && (
                      <p className="text-xs font-medium text-green-700 tabular-nums">
                        בוצע בפועל: {loggedLine}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {orphanedLogs.length > 0 && (
        <Card className="rounded-2xl border-dashed py-0">
          <CardContent className="space-y-1 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              רישומים של המתאמן לתרגילים שהוסרו מהאימון:
            </p>
            {orphanedLogs.map((log) => (
              <p key={log.id} className="text-xs text-muted-foreground tabular-nums">
                {log.name} —{" "}
                <span className="font-medium text-green-700">{log.line}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sticky on mobile so the trainer never scrolls back up to save. */}
      <div className="fixed inset-x-0 bottom-16 z-40 flex justify-between gap-2 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-6 md:static md:bg-none md:p-0">
        {session ? (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="me-2 h-4 w-4" />
            מחיקה
          </Button>
        ) : (
          <span />
        )}

        <Button
          className="flex-1 rounded-xl bg-forest font-bold hover:bg-forest-light md:flex-initial md:px-8"
          onClick={handleSave}
          disabled={saving || rows.length === 0}
        >
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
