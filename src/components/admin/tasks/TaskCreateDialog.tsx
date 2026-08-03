"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTasksAction } from "@/lib/actions/admin-tasks";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { taskCreateSchema, type TaskCreateInput } from "@/lib/validations/tasks";
import { TraineeSelect } from "./TraineeSelect";

/** Values a duplicate action prefills. The due date is deliberately left blank. */
export interface TaskCreateDefaults {
  title: string;
  description: string;
  traineeId: string | null;
  trainerIds: string[];
}

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** Today in Israel, as the minimum selectable due date. */
  today: string;
  defaults?: TaskCreateDefaults;
}

const EMPTY_DEFAULTS: TaskCreateDefaults = {
  title: "",
  description: "",
  traineeId: null,
  trainerIds: [],
};

export function TaskCreateDialog({
  open,
  onOpenChange,
  trainers,
  trainees,
  today,
  defaults = EMPTY_DEFAULTS,
}: TaskCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof taskCreateSchema>, unknown, TaskCreateInput>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: defaults.title,
      description: defaults.description,
      trainerIds: defaults.trainerIds,
      traineeId: defaults.traineeId,
      dueDate: today,
    },
  });

  const trainerIds = watch("trainerIds") ?? [];
  const traineeId = watch("traineeId") ?? null;

  const toggleTrainer = (id: string, checked: boolean) => {
    const next = checked
      ? [...trainerIds, id]
      : trainerIds.filter((existing) => existing !== id);
    setValue("trainerIds", next, { shouldValidate: true });
  };

  const onSubmit = async (data: TaskCreateInput) => {
    setLoading(true);
    try {
      const result = await createTasksAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.length === 1
          ? "המשימה נוצרה"
          : `נוצרו ${result.data.length} משימות`,
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה ביצירת המשימה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
          <DialogDescription>
            בחירת כמה מאמנים יוצרת משימה נפרדת לכל אחד, כך שכל מאמן סוגר את שלו.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">כותרת</Label>
            <Input
              id="task-title"
              placeholder="לדוגמה: לתקן את הרשת בשער הצפוני"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">פירוט (אופציונלי)</Label>
            <Textarea id="task-description" rows={3} {...register("description")} />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-due-date">תאריך יעד</Label>
            <Input id="task-due-date" type="date" min={today} {...register("dueDate")} />
            {errors.dueDate && (
              <p className="text-sm text-destructive">{errors.dueDate.message}</p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">מאמנים</legend>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              {trainers.map((trainer) => (
                <div key={trainer.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`trainer-${trainer.id}`}
                    checked={trainerIds.includes(trainer.id)}
                    onCheckedChange={(value) =>
                      toggleTrainer(trainer.id, value === true)
                    }
                  />
                  <Label
                    htmlFor={`trainer-${trainer.id}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {trainer.full_name ?? "ללא שם"}
                  </Label>
                </div>
              ))}
            </div>
            {errors.trainerIds && (
              <p className="text-sm text-destructive">{errors.trainerIds.message}</p>
            )}
          </fieldset>

          <TraineeSelect
            trainees={trainees}
            value={traineeId}
            onChange={(value) => setValue("traineeId", value)}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              יצירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
