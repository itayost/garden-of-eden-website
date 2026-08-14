"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { logExerciseAction } from "@/lib/actions/trainee-workout";
import {
  clampToStep,
  formatMeasures,
  numText,
  resolveTrackingProfile,
  weightQuickAdds,
  type MeasureValues,
} from "@/lib/utils/performance-profile";
import { MEASURE_BOUNDS } from "@/lib/validations/measures";
import type { SessionEquipmentRef } from "@/types/training-session";
import { DurationStepper } from "./DurationStepper";
import { StepperInput } from "./StepperInput";

export interface LogDialogValues {
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
}

export interface LogDialogTarget {
  exerciseId: string;
  exerciseName: string;
  sessionExerciseId: string | null;
  equipmentId: string | null;
  /** The machine's profile. Null renders the plain sets/reps/weight form. */
  equipment: SessionEquipmentRef | null;
  /** Prefills for correcting an existing log. */
  existing?: LogDialogValues;
  /** Where a fresh log starts: target, then last log, then defaults. */
  prefill?: LogDialogValues;
  /** What the trainee did last time on this exercise, shown as a hint. */
  previous?: MeasureValues | null;
}

interface LogExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: LogDialogTarget;
}

/**
 * The quick log form — the heart of the QR flow. Stepper rows with
 * thumb-sized −/+ targets: a 10-year-old at a squat rack never fights the
 * phone's number keyboard mid-set.
 *
 * Which rows appear is decided by the scanned machine. A jump rope shows no
 * weight field at all, and the machine's stack drives the stepper increment
 * and the input's min/max. Note the stack is a UI guide, not an invariant:
 * the server validates against the global 0-500 range, matching the DB CHECK.
 */
export function LogExerciseDialog({
  open,
  onOpenChange,
  target,
}: LogExerciseDialogProps) {
  const router = useRouter();

  const profile = resolveTrackingProfile(target.equipment);
  const start = target.existing ?? target.prefill ?? null;

  const [sets, setSets] = useState(numText(start?.sets));
  const [reps, setReps] = useState(numText(start?.reps));
  const [weight, setWeight] = useState(numText(start?.weightKg));
  const [duration, setDuration] = useState(numText(start?.durationSeconds));
  const [distance, setDistance] = useState(numText(start?.distanceM));
  const [loading, setLoading] = useState(false);

  const quickAdds = weightQuickAdds(profile.weightStepKg);

  const addWeight = (delta: number) => {
    const base = weight === "" ? (profile.weightMinKg ?? 0) : Number(weight);
    const next = clampToStep((Number.isFinite(base) ? base : 0) + delta, {
      min: profile.weightMinKg,
      max: profile.weightMaxKg ?? MEASURE_BOUNDS.weightKg.max,
      step: profile.weightStepKg,
    });
    setWeight(next === null ? "" : String(next));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await logExerciseAction({
        exerciseId: target.exerciseId,
        sessionExerciseId: target.sessionExerciseId,
        equipmentId: target.equipmentId,
        // Send only what this machine measures. A stale value behind a hidden
        // row would otherwise be recorded as if the trainee had entered it.
        sets,
        reps: profile.tracksReps ? reps : "",
        weightKg: profile.tracksWeight ? weight : "",
        durationSeconds: profile.tracksDuration ? duration : "",
        distanceM: profile.tracksDistance ? distance : "",
        note: "",
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("נרשם! כל הכבוד");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הרישום");
    } finally {
      setLoading(false);
    }
  };

  const previousLine = target.previous
    ? formatMeasures(target.previous, { compact: true })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{target.exerciseName}</DialogTitle>
          <DialogDescription>
            {target.existing ? "עדכון הרישום — מה עשית בפועל?" : "מה עשית בפועל?"}
          </DialogDescription>
        </DialogHeader>

        {/* The single most motivating number on the screen, and it costs one
            query: what he did last time on this exact exercise. */}
        {previousLine && (
          <p className="flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2 text-xs font-medium text-amber-800 tabular-nums">
            <History className="h-3.5 w-3.5 shrink-0" />
            בפעם הקודמת
            <span className="font-extrabold">{previousLine}</span>
          </p>
        )}

        {target.equipment?.howto_he && (
          <p className="text-xs text-muted-foreground">
            {target.equipment.howto_he}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <StepperInput
              id="log-sets"
              label="סטים"
              value={sets}
              onChange={setSets}
              min={MEASURE_BOUNDS.sets.min}
              max={MEASURE_BOUNDS.sets.max}
            />

            {profile.tracksReps && (
              <StepperInput
                id="log-reps"
                label="חזרות"
                value={reps}
                onChange={setReps}
                min={MEASURE_BOUNDS.reps.min}
                max={MEASURE_BOUNDS.reps.max}
              />
            )}

            {profile.tracksWeight && (
              <>
                <StepperInput
                  id="log-weight"
                  label='משקל (ק"ג)'
                  value={weight}
                  onChange={setWeight}
                  min={profile.weightMinKg ?? 0}
                  max={profile.weightMaxKg ?? MEASURE_BOUNDS.weightKg.max}
                  step={profile.weightStepKg}
                  inputMode="decimal"
                />
                <div className="flex justify-end gap-1.5">
                  {quickAdds.map((delta) => (
                    <Button
                      key={delta}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs tabular-nums"
                      onClick={() => addWeight(delta)}
                    >
                      +{delta}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {profile.tracksDuration && (
              <DurationStepper
                id="log-duration"
                label="זמן"
                value={duration}
                onChange={setDuration}
              />
            )}

            {profile.tracksDistance && (
              <StepperInput
                id="log-distance"
                label="מרחק (מטרים)"
                value={distance}
                onChange={setDistance}
                min={MEASURE_BOUNDS.distanceM.min}
                max={MEASURE_BOUNDS.distanceM.max}
                step={50}
              />
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-2xl bg-grass text-base font-bold text-forest hover:bg-grass/90"
            disabled={loading}
          >
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
