"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookmarkPlus,
  Copy,
  History,
  Loader2,
  Plus,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type { WorkoutExercise, WorkoutProgram } from "@/features/workouts/lib/types";
import {
  deleteSessionAction,
  getPreviousSessionAction,
  upsertSessionAction,
} from "@/lib/actions/training-sessions";
import { formatDate } from "@/lib/utils/date";
import {
  exerciseToBuilderRow,
  makeBuilderRow,
  rowsToExerciseInput,
} from "@/lib/utils/session-import";
import { formatMeasures, numText } from "@/lib/utils/performance-profile";
import { MAX_EXERCISES_PER_SESSION } from "@/lib/validations/training-session";
import type { SessionTemplateSummary } from "@/types/session-template";
import type {
  SessionBuilderRow,
  TrainingSession,
} from "@/types/training-session";
import { CopyFromProgramDialog } from "./CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "./CopyFromTemplateDialog";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { SessionRowsEditor } from "./SessionRowsEditor";

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
  templates: SessionTemplateSummary[];
}

function sessionToRows(session: TrainingSession): SessionBuilderRow[] {
  return session.exercises.map((exercise) =>
    makeBuilderRow({
      key: exercise.id,
      exerciseId: exercise.exercise_id,
      exerciseName:
        exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל",
      targetSets: exercise.target_sets,
      targetReps: exercise.target_reps_he ?? "",
      targetLoad: exercise.target_load_he ?? "",
      targetRepsNum: numText(exercise.target_reps),
      targetWeightKg: numText(exercise.target_weight_kg),
      targetDurationSeconds: numText(exercise.target_duration_seconds),
      targetDistanceM: numText(exercise.target_distance_m),
      notes: exercise.notes_he ?? "",
      equipment: exercise.exercise?.equipment_ref ?? null,
    }),
  );
}

export function SessionBuilder({
  traineeId,
  traineeName,
  date,
  slotId,
  session,
  loadError,
  programs,
  templates,
}: SessionBuilderProps) {
  const router = useRouter();
  const [rows, setRows] = useState<SessionBuilderRow[]>(
    session ? sessionToRows(session) : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copyProgramOpen, setCopyProgramOpen] = useState(false);
  const [copyTemplateOpen, setCopyTemplateOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  // Bumped only on OPEN, so the name field re-prefills each time without the
  // close animation being cut short by a remount. Same idiom as the task
  // duplicate flow.
  const [saveTemplateInstance, setSaveTemplateInstance] = useState(0);
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
      if (log) map[exercise.id] = formatMeasures(log);
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
        line: formatMeasures(exercise.logs![0]),
      }));
  }, [session, rows]);

  /**
   * Appends rows up to the per-session cap, naming what was left out.
   *
   * Refusing at save time instead would throw away a composition the trainer
   * had already tuned; refusing silently would be worse.
   *
   * Reads `rows` from the render rather than a setRows updater: it toasts, and
   * React may call an updater more than once, which would fire the toast
   * twice. Both callers run from a user event, so `rows` is current.
   */
  const appendCapped = (incoming: SessionBuilderRow[]) => {
    const room = MAX_EXERCISES_PER_SESSION - rows.length;
    if (incoming.length > room) {
      toast.error(
        `אפשר עד ${MAX_EXERCISES_PER_SESSION} תרגילים באימון — ${incoming.length - Math.max(room, 0)} לא נוספו`,
      );
    }
    if (room <= 0) return;
    setRows([...rows, ...incoming.slice(0, room)]);
  };

  // Imports MERGE into the current list rather than replacing it — wiping
  // rows the trainer already tuned would be silent data loss. Exercises
  // already present keep their edited targets; only new ones are appended.
  const mergeRows = (incoming: SessionBuilderRow[]) => {
    const existingIds = new Set(rows.map((row) => row.exerciseId));
    appendCapped(incoming.filter((row) => !existingIds.has(row.exerciseId)));
  };

  const addExercises = (exercises: WorkoutExercise[]) => {
    appendCapped(
      exercises.map((exercise, index) =>
        exerciseToBuilderRow(
          exercise,
          `new-${exercise.id}-${rows.length + index}-${Date.now()}`,
        ),
      ),
    );
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
        exercises: rowsToExerciseInput(rows),
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

      {/* Add is the primary act; the three copy sources are one intent and
          share a menu; saving as a template is an export, so it sits apart. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          הוספת תרגילים
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={loadingPrevious}>
              {loadingPrevious ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="me-2 h-4 w-4" />
              )}
              ייבוא מ...
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => setCopyTemplateOpen(true)}
              disabled={templates.length === 0}
            >
              <BookmarkPlus className="me-2 h-4 w-4" />
              מתבנית
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setCopyProgramOpen(true)}
              disabled={programs.length === 0}
            >
              <Copy className="me-2 h-4 w-4" />
              מתוכנית
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={loadPrevious}>
              <History className="me-2 h-4 w-4" />
              מאימון קודם
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          className="ms-auto"
          onClick={() => {
            setSaveTemplateInstance((n) => n + 1);
            setSaveTemplateOpen(true);
          }}
          disabled={rows.length === 0}
        >
          <BookmarkPlus className="me-2 h-4 w-4" />
          שמירה כתבנית
        </Button>
      </div>

      <SessionRowsEditor
        rows={rows}
        onRowsChange={setRows}
        logByRowKey={logByRowKey}
        emptyMessage="אין תרגילים עדיין — הוסף מהמאגר, ייבא מתבנית או מתוכנית, או שכפל אימון קודם."
      />

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
        onAdd={addExercises}
        alreadyAddedIds={rows.map((row) => row.exerciseId)}
      />

      <CopyFromTemplateDialog
        open={copyTemplateOpen}
        onOpenChange={setCopyTemplateOpen}
        templates={templates}
        onImport={mergeRows}
      />

      <CopyFromProgramDialog
        open={copyProgramOpen}
        onOpenChange={setCopyProgramOpen}
        programs={programs}
        onImport={mergeRows}
      />

      <SaveAsTemplateDialog
        key={saveTemplateInstance}
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        rows={rows}
        defaultName={`אימון ${formatDate(date)}`}
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
