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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logExerciseAction } from "@/lib/actions/trainee-workout";

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

/**
 * The quick sets/reps/weight form — the heart of the QR flow. Numeric-only,
 * three fields, one tap to save; a 10-year-old at a squat rack fills it in
 * ten seconds.
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{target.exerciseName}</DialogTitle>
          <DialogDescription>
            {target.existing ? "עדכון הרישום — מה עשית בפועל?" : "מה עשית בפועל?"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="log-sets">סטים</Label>
              <Input
                id="log-sets"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={sets}
                onChange={(event) => setSets(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="log-reps">חזרות</Label>
              <Input
                id="log-reps"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={reps}
                onChange={(event) => setReps(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="log-weight">משקל (ק&quot;ג)</Label>
              <Input
                id="log-weight"
                type="number"
                inputMode="decimal"
                min={0}
                max={500}
                step={0.5}
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
