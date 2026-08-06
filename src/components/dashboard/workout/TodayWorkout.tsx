"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { completeMySessionAction } from "@/lib/actions/trainee-workout";
import { israelToday } from "@/lib/utils/tasks";
import type { SessionExercise, TrainingSession } from "@/types/training-session";
import { CompletionCelebration } from "./CompletionCelebration";
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

/** Target as compact pills: "3×8-10" reads faster than a sentence. */
function targetPills(exercise: SessionExercise): string[] {
  const pills: string[] = [];
  const setsReps = [
    exercise.target_sets ? `${exercise.target_sets}` : null,
    exercise.target_reps_he || null,
  ]
    .filter(Boolean)
    .join("×");
  if (setsReps) pills.push(`יעד ${setsReps}`);
  if (exercise.target_load_he) pills.push(exercise.target_load_he);
  return pills;
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

const HEBREW_WEEKDAYS = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
];

function weekdayLabel(isoDate: string): string {
  return HEBREW_WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
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
  const [openCues, setOpenCues] = useState<Record<string, boolean>>({});

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
  const progressPct = totalCount ? (loggedCount / totalCount) * 100 : 0;

  const totalSets =
    session?.exercises.reduce(
      (sum, exercise) => sum + (exercise.logs?.[0]?.sets ?? 0),
      0,
    ) ?? 0;
  const totalWeight =
    session?.exercises.reduce(
      (sum, exercise) => sum + (exercise.logs?.[0]?.weight_kg ?? 0),
      0,
    ) ?? 0;

  return (
    // pb-24 clears the sticky CTA on mobile; desktop keeps the button in flow.
    <div className={cn("space-y-4", session && !isCompleted && "pb-24 md:pb-0")}>
      <div>
        <h1 className="font-display text-3xl text-forest">האימון שלי</h1>
        <p className="text-sm text-muted-foreground">
          {session
            ? `${weekdayLabel(session.session_date)} · ${session.built_by_name}`
            : weekdayLabel(israelToday())}
        </p>
      </div>

      {session ? (
        <>
          {/* The achievements-style gold gradient bar — progress is the star. */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold text-forest tabular-nums">
              {loggedCount}
              <span className="text-sm font-medium text-muted-foreground">
                /{totalCount}
              </span>
            </span>
            <div
              role="progressbar"
              aria-valuenow={loggedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              className="h-3 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {isCompleted && (
            <CompletionCelebration
              exerciseCount={totalCount}
              totalSets={totalSets}
              totalWeightKg={totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : null}
            />
          )}

          <div className="space-y-2.5">
            {session.exercises.map((exercise, index) => {
              const logged = loggedLine(exercise);
              const pills = targetPills(exercise);
              const cuesOpen = openCues[exercise.id] ?? false;
              return (
                <motion.div key={exercise.id} layout>
                  <Card
                    className={cn(
                      "rounded-2xl py-0 transition-colors",
                      logged && "border-grass/50 bg-grass/5",
                    )}
                  >
                    <CardContent className="flex items-start gap-3 px-4 py-3">
                      {logged ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 16 }}
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-grass text-white"
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </motion.span>
                      ) : (
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-sm font-extrabold text-cream">
                          {index + 1}
                        </span>
                      )}

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-bold leading-tight">
                          {exerciseName(exercise)}
                        </p>

                        {pills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pills.map((pill) => (
                              <span
                                key={pill}
                                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                              >
                                {pill}
                              </span>
                            ))}
                          </div>
                        )}

                        {logged && (
                          <p className="text-sm font-bold text-green-700 tabular-nums">
                            בוצע · {logged}
                          </p>
                        )}

                        {exercise.exercise?.cues_he && (
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCues((prev) => ({
                                  ...prev,
                                  [exercise.id]: !cuesOpen,
                                }))
                              }
                              className="flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                              aria-expanded={cuesOpen}
                            >
                              איך מבצעים?
                              <ChevronDown
                                className={cn(
                                  "h-3 w-3 transition-transform",
                                  cuesOpen && "rotate-180",
                                )}
                              />
                            </button>
                            {cuesOpen && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {exercise.exercise.cues_he}
                              </p>
                            )}
                          </div>
                        )}

                        {exercise.notes_he && (
                          <p className="text-xs text-muted-foreground">
                            הערת מאמן: {exercise.notes_he}
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={logged ? "outline" : "default"}
                        className={cn(
                          "self-center rounded-full",
                          !logged && "bg-forest hover:bg-forest-light",
                        )}
                        onClick={() => openLog(exercise)}
                      >
                        {logged ? "עדכון" : "בוצע"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {!isCompleted && (
            <div className="fixed inset-x-0 bottom-16 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-6 md:static md:bg-none md:p-0">
              <Button
                className="w-full rounded-2xl bg-forest text-base font-bold hover:bg-forest-light"
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
            </div>
          )}
        </>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="rounded-full bg-muted p-3">
              <Dumbbell className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-muted-foreground">
              אין אימון להיום. המאמן בונה את האימון ביום האימון — דברו איתו אם
              ציפיתם לאחד.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Free-log: the scanned equipment is outside today's session. */}
      {equipmentId && equipmentExercises.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">רישום חופשי מהמכשיר שסרקת</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {equipmentExercises.map((exercise) => (
              <Button
                key={exercise.id}
                variant="outline"
                size="sm"
                className="rounded-full"
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
