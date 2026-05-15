"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  nutritionMeasurementSchema,
  type MeasurementFormData,
  DEFAULT_MEASUREMENT,
} from "@/lib/validations/nutrition-measurements";
import { createMeasurement } from "@/features/nutrition/lib/actions/create-measurement";
import { updateMeasurement } from "@/features/nutrition/lib/actions/update-measurement";
import type { NutritionMeasurementRow } from "@/features/nutrition/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MeasurementFormProps {
  userId: string;
  /** Existing row when editing; null for "add new" mode */
  existing?: NutritionMeasurementRow | null;
  /** Optional ISO date string used to pre-fill age */
  dateOfBirth?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function calculateAge(measurementDate: string, dob: string): number | null {
  const dobDate = new Date(dob);
  const onDate = new Date(measurementDate);
  if (isNaN(dobDate.getTime()) || isNaN(onDate.getTime())) return null;
  let years = onDate.getFullYear() - dobDate.getFullYear();
  const monthDiff = onDate.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < dobDate.getDate())) {
    years -= 1;
  }
  return years >= 0 && years <= 120 ? years : null;
}

function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  if (heightM <= 0) return null;
  const bmi = weightKg / (heightM * heightM);
  if (!isFinite(bmi)) return null;
  return Math.round(bmi * 100) / 100;
}

function getDefaults(
  existing: NutritionMeasurementRow | null | undefined,
  dateOfBirth: string | null | undefined
): MeasurementFormData {
  if (existing) {
    return {
      measurement_date: existing.measurement_date,
      age: existing.age,
      height_cm: existing.height_cm,
      height_percentile: existing.height_percentile,
      weight_kg: existing.weight_kg,
      bmi: existing.bmi,
      bmi_percentile: existing.bmi_percentile,
      body_fat_percentage: existing.body_fat_percentage,
      notes: existing.notes,
    };
  }

  const measurementDate = DEFAULT_MEASUREMENT.measurement_date;
  return {
    ...DEFAULT_MEASUREMENT,
    age: dateOfBirth ? calculateAge(measurementDate, dateOfBirth) : null,
  };
}

export function MeasurementForm({
  userId,
  existing,
  dateOfBirth,
  onSuccess,
  onCancel,
}: MeasurementFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Track manual edits — once the user touches age/bmi, stop auto-recomputing.
  const ageTouched = useRef(Boolean(existing?.age));
  const bmiTouched = useRef(Boolean(existing?.bmi));

  const form = useForm<MeasurementFormData>({
    resolver: zodResolver(nutritionMeasurementSchema),
    defaultValues: getDefaults(existing, dateOfBirth),
  });

  const { register, handleSubmit, setValue, watch, formState } = form;

  const measurementDate = watch("measurement_date");
  const heightCm = watch("height_cm");
  const weightKg = watch("weight_kg");

  // Auto-fill age when measurement date changes, unless user has edited it.
  useEffect(() => {
    if (ageTouched.current) return;
    if (!dateOfBirth || !measurementDate) return;
    const computed = calculateAge(measurementDate, dateOfBirth);
    setValue("age", computed, { shouldDirty: false });
  }, [measurementDate, dateOfBirth, setValue]);

  // Auto-compute BMI from height + weight, unless user has edited BMI directly.
  useEffect(() => {
    if (bmiTouched.current) return;
    const computed = computeBmi(heightCm ?? null, weightKg ?? null);
    setValue("bmi", computed, { shouldDirty: false });
  }, [heightCm, weightKg, setValue]);

  const onSubmit = (data: MeasurementFormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = existing
        ? await updateMeasurement(existing.id, data)
        : await createMeasurement(userId, data);

      if ("error" in result) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(existing ? "המדידה עודכנה" : "המדידה נוספה");
      onSuccess();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="measurement_date">תאריך</Label>
          <Input
            id="measurement_date"
            type="date"
            {...register("measurement_date")}
          />
          {formState.errors.measurement_date && (
            <p className="text-sm text-destructive">
              {formState.errors.measurement_date.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">גיל</Label>
          <Input
            id="age"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            {...register("age", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
              onChange: () => {
                ageTouched.current = true;
              },
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="height_cm">גובה (ס&quot;מ)</Label>
          <Input
            id="height_cm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={300}
            {...register("height_cm", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="height_percentile">אחוזון גובה</Label>
          <Input
            id="height_percentile"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...register("height_percentile", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_kg">משקל (ק&quot;ג)</Label>
          <Input
            id="weight_kg"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={500}
            {...register("weight_kg", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bmi">BMI</Label>
          <Input
            id="bmi"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={200}
            {...register("bmi", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
              onChange: () => {
                bmiTouched.current = true;
              },
            })}
          />
          <p className="text-xs text-muted-foreground">
            מחושב אוטומטית מגובה ומשקל. ניתן להזנה ידנית.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bmi_percentile">אחוזון BMI</Label>
          <Input
            id="bmi_percentile"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...register("bmi_percentile", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body_fat_percentage">אחוז שומן</Label>
          <Input
            id="body_fat_percentage"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...register("body_fat_percentage", {
              setValueAs: (v) =>
                v === "" || v === null || v === undefined ? null : Number(v),
            })}
          />
          <p className="text-xs text-muted-foreground">גלוי רק לתזונאי/מאמן/אדמין.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">הערות</Label>
        <Textarea
          id="notes"
          rows={3}
          {...register("notes", {
            setValueAs: (v) =>
              v === "" || v === null || v === undefined ? null : String(v),
          })}
        />
      </div>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          ביטול
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {existing ? "שמור שינויים" : "הוסף מדידה"}
        </Button>
      </div>
    </form>
  );
}
