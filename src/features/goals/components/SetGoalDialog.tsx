"use client";

import { useState, useActionState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SetGoalDialogProps, PhysicalMetricKey } from "../types";
import { GOAL_METRICS, METRIC_LABELS_HE, METRIC_UNITS, isLowerBetterMetric } from "../lib/config/goal-config";
import { setGoal } from "../lib/actions/set-goal";
import { formatMetricValue } from "../lib/utils/goal-utils";

/**
 * Dialog for trainers to set goals for players
 */
export function SetGoalDialog({
  userId,
  open,
  onOpenChange,
  currentMetrics,
  existingGoals,
}: SetGoalDialogProps) {
  const [selectedMetric, setSelectedMetric] = useState<PhysicalMetricKey | "">("");
  const [targetValue, setTargetValue] = useState("");
  // Get available metrics (exclude those that already have active goals)
  const activeGoalMetrics = existingGoals
    .filter((g) => g.achieved_at === null)
    .map((g) => g.metric_key);

  const availableMetrics = GOAL_METRICS.filter(
    (metric) => !activeGoalMetrics.includes(metric)
  );

  // Get current value for selected metric
  const currentValue = selectedMetric ? currentMetrics[selectedMetric] : null;
  const unit = selectedMetric ? METRIC_UNITS[selectedMetric] : "";
  const isLowerBetter = selectedMetric ? isLowerBetterMetric(selectedMetric) : false;

  const [, formAction, isPending] = useActionState(
    async (
      prevState: { success: boolean; error: string | undefined },
      /* formData */ _: FormData
    ) => {
      if (!selectedMetric || !targetValue) {
        toast.error("יש למלא את כל השדות");
        return prevState;
      }

      const parsedValue = parseFloat(targetValue);
      if (isNaN(parsedValue) || parsedValue <= 0) {
        toast.error("יש להזין ערך מספרי חיובי");
        return prevState;
      }

      const result = await setGoal({
        userId,
        metricKey: selectedMetric,
        targetValue: parsedValue,
        baselineValue: currentValue ?? undefined,
      });

      if (result.success) {
        toast.success("היעד נוצר בהצלחה");
        onOpenChange(false);
        setSelectedMetric("");
        setTargetValue("");
      } else {
        toast.error(result.error || "שגיאה ביצירת היעד");
      }

      return { success: result.success, error: result.error };
    },
    { success: false, error: undefined }
  );

  const handleClose = () => {
    if (!isPending) {
      onOpenChange(false);
      setSelectedMetric("");
      setTargetValue("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הגדרת יעד חדש</DialogTitle>
          <DialogDescription>
            בחר מדד והגדר ערך יעד לשחקן
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="metric">מדד</Label>
            <Select
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as PhysicalMetricKey)}
              disabled={isPending}
            >
              <SelectTrigger id="metric" className="w-full">
                <SelectValue placeholder="בחר מדד" />
              </SelectTrigger>
              <SelectContent>
                {availableMetrics.length === 0 ? (
                  <SelectItem value="none" disabled>
                    כל המדדים כבר מוגדרים
                  </SelectItem>
                ) : (
                  availableMetrics.map((metric) => (
                    <SelectItem key={metric} value={metric}>
                      {METRIC_LABELS_HE[metric]}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedMetric && (
            <>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ערך נוכחי:</span>
                  <span className="font-medium">
                    {formatMetricValue(currentValue ?? null, selectedMetric)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">יחידות:</span>
                  <span>{unit}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">כיוון שיפור:</span>
                  <span>{isLowerBetter ? "נמוך יותר = טוב יותר" : "גבוה יותר = טוב יותר"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target">ערך יעד ({unit})</Label>
                <Input
                  id="target"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={`לדוגמה: ${isLowerBetter ? "1.20" : "250"}`}
                  disabled={isPending}
                />
                {currentValue != null && targetValue && (
                  <p className="text-xs text-muted-foreground">
                    {isLowerBetter
                      ? parseFloat(targetValue) < currentValue
                        ? `שיפור של ${(currentValue - parseFloat(targetValue)).toFixed(3)} ${unit}`
                        : "היעד צריך להיות נמוך מהערך הנוכחי"
                      : parseFloat(targetValue) > currentValue
                        ? `שיפור של ${(parseFloat(targetValue) - currentValue).toFixed(1)} ${unit}`
                        : "היעד צריך להיות גבוה מהערך הנוכחי"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            ביטול
          </Button>
          <form action={formAction}>
            <Button
              type="submit"
              disabled={isPending || !selectedMetric || !targetValue || availableMetrics.length === 0}
            >
              {isPending ? "יוצר יעד..." : "צור יעד"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
