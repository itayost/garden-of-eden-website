"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createExercise, updateExercise } from "@/features/workouts/lib/actions";
import { exerciseSchema } from "@/lib/validations/workout-exercise";
import type { ExerciseInput } from "@/lib/validations/workout-exercise";
import { MAIN_CATEGORIES } from "@/features/workouts/lib/types";
import type { WorkoutExercise } from "@/features/workouts/lib/types";
import { MeasureBadges } from "@/components/admin/equipment/MeasureBadges";
import { numText, resolveDefaults } from "@/lib/utils/performance-profile";
import { NumberField } from "@/components/ui/number-field";
import type { Equipment } from "@/types/equipment";

const NO_EQUIPMENT_VALUE = "__none__";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExerciseFormProps {
  exercise?: WorkoutExercise;
  /** The catalog, already loaded by the table — the dialog does not refetch. */
  equipmentOptions: Equipment[];
  onSaved: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// ExerciseForm
// ---------------------------------------------------------------------------

export function ExerciseForm({
  exercise,
  equipmentOptions,
  onSaved,
  onCancel,
}: ExerciseFormProps) {
  const isEdit = Boolean(exercise);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExerciseInput>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      main_category: exercise?.mainCategory ?? "",
      sub_category: exercise?.subCategory ?? null,
      name_he: exercise?.nameHe ?? null,
      name_en: exercise?.nameEn ?? null,
      equipment: exercise?.equipment ?? null,
      equipment_id: exercise?.equipmentId ?? null,
      cues_he: exercise?.cuesHe ?? null,
      goal_he: exercise?.goalHe ?? null,
      default_sets: numText(exercise?.defaultSets),
      default_reps: numText(exercise?.defaultReps),
      default_weight_kg: numText(exercise?.defaultWeightKg),
      default_duration_seconds: numText(exercise?.defaultDurationSeconds),
      default_distance_m: numText(exercise?.defaultDistanceM),
    },
  });

  const mainCategoryValue = watch("main_category");
  const equipmentIdValue = watch("equipment_id");

  const selectedEquipment =
    equipmentOptions.find((item) => item.id === equipmentIdValue) ?? null;

  // Shown as placeholders, so an empty override reads as "inherits this".
  const inherited = resolveDefaults(null, selectedEquipment);

  const onSubmit = (data: ExerciseInput) => {
    startTransition(async () => {
      const result = isEdit && exercise
        ? await updateExercise(exercise.id, data)
        : await createExercise(data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "תרגיל עודכן" : "תרגיל נוצר");
      onSaved();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* main_category */}
      <div className="space-y-1">
        <Label htmlFor="main-category">קטגוריה ראשית *</Label>
        <Select
          value={mainCategoryValue}
          onValueChange={(val) => setValue("main_category", val, { shouldValidate: true })}
          disabled={pending}
        >
          <SelectTrigger id="main-category">
            <SelectValue placeholder="בחר קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            {MAIN_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.main_category && (
          <p className="text-destructive text-xs">{errors.main_category.message}</p>
        )}
      </div>

      {/* sub_category */}
      <div className="space-y-1">
        <Label htmlFor="sub-category">תת-קטגוריה</Label>
        <Input
          id="sub-category"
          placeholder="למשל: קפיצות"
          disabled={pending}
          {...register("sub_category")}
        />
        {errors.sub_category && (
          <p className="text-destructive text-xs">{errors.sub_category.message}</p>
        )}
      </div>

      {/* name_he */}
      <div className="space-y-1">
        <Label htmlFor="name-he">שם בעברית</Label>
        <Input
          id="name-he"
          placeholder="למשל: סקוואט עם משקל"
          disabled={pending}
          {...register("name_he")}
        />
        {errors.name_he && (
          <p className="text-destructive text-xs">{errors.name_he.message}</p>
        )}
      </div>

      {/* name_en */}
      <div className="space-y-1">
        <Label htmlFor="name-en">שם באנגלית</Label>
        <Input
          id="name-en"
          placeholder="e.g. Barbell Squat"
          dir="ltr"
          disabled={pending}
          {...register("name_en")}
        />
        {errors.name_en && (
          <p className="text-destructive text-xs">{errors.name_en.message}</p>
        )}
      </div>

      {/* equipment_id — structured link, drives QR scan matching */}
      <div className="space-y-1">
        <Label htmlFor="equipment-id">ציוד מהקטלוג</Label>
        <Select
          value={equipmentIdValue ?? NO_EQUIPMENT_VALUE}
          onValueChange={(v) =>
            setValue("equipment_id", v === NO_EQUIPMENT_VALUE ? null : v)
          }
          disabled={pending}
        >
          <SelectTrigger id="equipment-id">
            <SelectValue placeholder="ללא ציוד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_EQUIPMENT_VALUE}>ללא ציוד</SelectItem>
            {equipmentOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name_he}
                {item.is_active ? "" : " (לא פעיל)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          הקישור לקטלוג קובע לאיזה תרגיל תקפוץ סריקת ה-QR של המכשיר.
        </p>
      </div>

      {/* What the linked machine measures, and what this exercise inherits.
          Read-only: tracking is a physical property of the machine. */}
      {selectedEquipment && (
        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">נמדד במכשיר</span>
            <MeasureBadges measures={selectedEquipment} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">ברירות מחדל לתרגיל הזה</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <NumberField
                id="default-sets"
                label="סטים"
                placeholder={numText(inherited.sets) || "—"}
                disabled={pending}
                {...register("default_sets")}
              />
              {selectedEquipment.tracks_reps && (
                <NumberField
                  id="default-reps"
                  label="חזרות"
                  placeholder={numText(inherited.reps) || "—"}
                  disabled={pending}
                  {...register("default_reps")}
                />
              )}
              {selectedEquipment.tracks_weight && (
                <NumberField
                  id="default-weight"
                  label='משקל (ק"ג)'
                  placeholder={numText(inherited.weightKg) || "—"}
                  disabled={pending}
                  {...register("default_weight_kg")}
                />
              )}
              {selectedEquipment.tracks_duration && (
                <NumberField
                  id="default-duration"
                  label="זמן (שניות)"
                  placeholder={numText(inherited.durationSeconds) || "—"}
                  disabled={pending}
                  {...register("default_duration_seconds")}
                />
              )}
              {selectedEquipment.tracks_distance && (
                <NumberField
                  id="default-distance"
                  label="מרחק (מטרים)"
                  placeholder={numText(inherited.distanceM) || "—"}
                  disabled={pending}
                  {...register("default_distance_m")}
                />
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              ריק = יורש מהמכשיר (המספר האפור). מלא רק אם התרגיל הזה שונה.
            </p>
          </div>
        </div>
      )}

      {/* equipment (free text fallback) */}
      <div className="space-y-1">
        <Label htmlFor="equipment">ציוד (טקסט חופשי)</Label>
        <Input
          id="equipment"
          placeholder="למשל: משקל חופשי, מוט"
          disabled={pending}
          {...register("equipment")}
        />
        {errors.equipment && (
          <p className="text-destructive text-xs">{errors.equipment.message}</p>
        )}
      </div>

      {/* cues_he */}
      <div className="space-y-1">
        <Label htmlFor="cues-he">הוראות ביצוע</Label>
        <Textarea
          id="cues-he"
          placeholder="הוראות טכניות לביצוע התרגיל..."
          rows={3}
          disabled={pending}
          {...register("cues_he")}
        />
        {errors.cues_he && (
          <p className="text-destructive text-xs">{errors.cues_he.message}</p>
        )}
      </div>

      {/* goal_he */}
      <div className="space-y-1">
        <Label htmlFor="goal-he">מטרת התרגיל</Label>
        <Textarea
          id="goal-he"
          placeholder="תיאור מטרת התרגיל..."
          rows={2}
          disabled={pending}
          {...register("goal_he")}
        />
        {errors.goal_he && (
          <p className="text-destructive text-xs">{errors.goal_he.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          ביטול
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
          {isEdit ? "שמור שינויים" : "צור תרגיל"}
        </Button>
      </div>
    </form>
  );
}
