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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExerciseFormProps {
  exercise?: WorkoutExercise;
  onSaved: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// ExerciseForm
// ---------------------------------------------------------------------------

export function ExerciseForm({ exercise, onSaved, onCancel }: ExerciseFormProps) {
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
      cues_he: exercise?.cuesHe ?? null,
      goal_he: exercise?.goalHe ?? null,
    },
  });

  const mainCategoryValue = watch("main_category");

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

      {/* equipment */}
      <div className="space-y-1">
        <Label htmlFor="equipment">ציוד</Label>
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
