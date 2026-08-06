"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Dumbbell, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { completeMySessionAction } from "@/lib/actions/trainee-workout";
import type { SessionExercise, TrainingSession } from "@/types/training-session";
import {
  LogExerciseDialog,
  type LogDialogTarget,
} from "./LogExerciseDialog";

interface TodayWorkoutProps {
  session: TrainingSession | null;
  loadError: string | null;
  /** Session exercise to auto-open (arrived via QR scan). */
  focusId: string | null;
  /** Equipment scanned, for free-log mode and log attribution. */
  equipmentId: string | null;
  equipmentExercises: { id: string; name_he: string | null; name_en: string | null }[];
}

function exerciseName(exercise: SessionExercise): string {
  return exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל";
}

function targetLine(exercise: SessionExercise): string {
  const parts: string[] = [];
  if (exercise.target_sets) parts.push(`${exercise.target_sets} סטים`);
  if (exercise.target_reps_he) parts.push(`${exercise.target_reps_he} חזרות`);
  if (exercise.target_load_he) parts.push(exercise.target_load_he);
  return parts.join(" · ");
}

function loggedLine(exercise: SessionExercise): string | null {
  const log = exercise.logs?.[0];
  if (!log) return null;
  const parts: string[] = [];
  if (log.sets) parts.push(`${log.sets} סטים`);
  if (log.reps) parts.push(`${log.reps} חזרות`);
  if (log.weight_kg !== null && log.weight_kg !== undefined)
    parts.push(`${log.weight_kg} ק"ג`);
  return parts.join(" · ");
}

export function TodayWorkout({
  session,
  loadError,
  focusId,
  equipmentId,
  equipmentExercises,
}: TodayWorkoutProps) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  const focusExercise = useMemo(
    () => session?.exercises.find((exercise) => exercise.id === focusId) ?? null,
    [session, focusId],
  );

  const [logTarget, setLogTarget] = useState<LogDialogTarget | null>(() =>
    // A QR scan lands here with ?focus= — open the right form immediately.
    focusExercise
      ? {
          exerciseId: focusExercise.exercise_id,
          exerciseName: exerciseName(focusExercise),
          sessionExerciseId: focusExercise.id,
          equipmentId,
          targetSets: focusExercise.target_sets,
          existing: focusExercise.logs?.[0]
            ? {
                sets: focusExercise.logs[0].sets,
                reps: focusExercise.logs[0].reps,
                weightKg: focusExercise.logs[0].weight_kg,
              }
            : undefined,
        }
      : null,
  );
  const [dialogInstance, setDialogInstance] = useState(0);

  const openLog = (exercise: SessionExercise) => {
    const log = exercise.logs?.[0];
    setLogTarget({
      exerciseId: exercise.exercise_id,
      exerciseName: exerciseName(exercise),
      sessionExerciseId: exercise.id,
      equipmentId: null,
      targetSets: exercise.target_sets,
      existing: log
        ? { sets: log.sets, reps: log.reps, weightKg: log.weight_kg }
        : undefined,
    });
    setDialogInstance((n) => n + 1);
  };

  const openFreeLog = (exercise: {
    id: string;
    name_he: string | null;
    name_en: string | null;
  }) => {
    setLogTarget({
      exerciseId: exercise.id,
      exerciseName: exercise.name_he ?? exercise.name_en ?? "תרגיל",
      sessionExerciseId: null,
      equipmentId,
    });
    setDialogInstance((n) => n + 1);
  };

  const handleComplete = async () => {
    if (!session) return;
    setCompleting(true);
    try {
      const result = await completeMySessionAction(session.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("סיימת את האימון! עבודה מעולה");
      router.refresh();
    } catch {
      toast.error("שגיאה בסיום האימון");
    } finally {
      setCompleting(false);
    }
  };

  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-12 text-center text-destructive">
          {loadError}
        </CardContent>
      </Card>
    );
  }

  const loggedCount =
    session?.exercises.filter((exercise) => (exercise.logs?.length ?? 0) > 0)
      .length ?? 0;
  const totalCount = session?.exercises.length ?? 0;
  const allLogged = totalCount > 0 && loggedCount === totalCount;
  const isCompleted = Boolean(session?.completed_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Dumbbell className="h-5 w-5" />
          האימון שלי היום
        </h1>
        {session && (
          <span className="text-sm text-muted-foreground">
            {loggedCount}/{totalCount} תרגילים
          </span>
        )}
      </div>

      {session ? (
        <>
          <Progress value={totalCount ? (loggedCount / totalCount) * 100 : 0} />

          {isCompleted && (
            <Card className="border-green-500">
              <CardContent className="flex items-center gap-2 py-4 text-green-700 dark:text-green-400">
                <PartyPopper className="h-5 w-5" />
                האימון הושלם — כל הכבוד!
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {session.exercises.map((exercise, index) => {
              const logged = loggedLine(exercise);
              const targets = targetLine(exercise);
              return (
                <Card
                  key={exercise.id}
                  className={logged ? "border-green-300 dark:border-green-800" : undefined}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {logged && <Check className="h-4 w-4 text-green-600" />}
                      {index + 1}. {exerciseName(exercise)}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant={logged ? "outline" : "default"}
                      onClick={() => openLog(exercise)}
                    >
                      {logged ? "עדכון" : "בוצע"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {targets && (
                      <p className="text-muted-foreground">יעד: {targets}</p>
                    )}
                    {logged && (
                      <p className="font-medium text-green-700 dark:text-green-400">
                        בוצע: {logged}
                      </p>
                    )}
                    {exercise.exercise?.cues_he && (
                      <p className="text-xs text-muted-foreground">
                        {exercise.exercise.cues_he}
                      </p>
                    )}
                    {exercise.notes_he && (
                      <p className="text-xs text-muted-foreground">
                        הערת מאמן: {exercise.notes_he}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!isCompleted && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleComplete}
              disabled={completing || !allLogged}
            >
              {completing ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 h-4 w-4" />
              )}
              {allLogged
                ? "סיימתי את האימון"
                : `נשארו ${totalCount - loggedCount} תרגילים`}
            </Button>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין אימון להיום. המאמן בונה את האימון ביום האימון — דברו איתו אם
            ציפיתם לאחד.
          </CardContent>
        </Card>
      )}

      {/* Free-log: the scanned equipment is outside today's session. */}
      {equipmentId && equipmentExercises.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">רישום חופשי מהמכשיר שסרקת</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {equipmentExercises.map((exercise) => (
              <Button
                key={exercise.id}
                variant="outline"
                size="sm"
                onClick={() => openFreeLog(exercise)}
              >
                <Badge variant="secondary" className="me-2">
                  +
                </Badge>
                {exercise.name_he ?? exercise.name_en ?? "תרגיל"}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {logTarget && (
        <LogExerciseDialog
          key={dialogInstance}
          open
          onOpenChange={(next) => !next && setLogTarget(null)}
          target={logTarget}
        />
      )}
    </div>
  );
}
