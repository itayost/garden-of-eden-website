"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { StepperInput } from "./StepperInput";

export interface LogDialogTarget {
  exerciseId: string;
  exerciseName: string;
  sessionExerciseId: string | null;
  equipmentId: string | null;
  /** Prefills for correcting an existing log. */
  existing?: { sets: number | null; reps: number | null; weightKg: number | null };
  /** Target sets prefill for a fresh log. */
  targetSets?: number | null;
}

interface LogExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: LogDialogTarget;
}

const WEIGHT_QUICK_ADDS = [1, 2.5, 5];

/**
 * The quick sets/reps/weight form — the heart of the QR flow. Stepper rows
 * with thumb-sized −/+ targets: a 10-year-old at a squat rack never fights
 * the phone's number keyboard mid-set. Typing stays possible.
 */
export function LogExerciseDialog({
  open,
  onOpenChange,
  target,
}: LogExerciseDialogProps) {
  const router = useRouter();
  const [sets, setSets] = useState(
    target.existing?.sets?.toString() ?? target.targetSets?.toString() ?? "",
  );
  const [reps, setReps] = useState(target.existing?.reps?.toString() ?? "");
  const [weight, setWeight] = useState(
    target.existing?.weightKg?.toString() ?? "",
  );
  const [loading, setLoading] = useState(false);

  const addWeight = (delta: number) => {
    const base = weight === "" ? 0 : Number(weight);
    const next = Math.min((Number.isFinite(base) ? base : 0) + delta, 500);
    setWeight(String(Math.round(next * 100) / 100));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await logExerciseAction({
        exerciseId: target.exerciseId,
        sessionExerciseId: target.sessionExerciseId,
        equipmentId: target.equipmentId,
        sets,
        reps,
        weightKg: weight,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{target.exerciseName}</DialogTitle>
          <DialogDescription>
            {target.existing ? "עדכון הרישום — מה עשית בפועל?" : "מה עשית בפועל?"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <StepperInput
              id="log-sets"
              label="סטים"
              value={sets}
              onChange={setSets}
              min={1}
              max={99}
            />
            <StepperInput
              id="log-reps"
              label="חזרות"
              value={reps}
              onChange={setReps}
              min={1}
              max={999}
            />
            <StepperInput
              id="log-weight"
              label={'משקל (ק"ג)'}
              value={weight}
              onChange={setWeight}
              min={0}
              max={500}
              step={0.5}
              inputMode="decimal"
            />
            <div className="flex justify-end gap-1.5">
              {WEIGHT_QUICK_ADDS.map((delta) => (
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
