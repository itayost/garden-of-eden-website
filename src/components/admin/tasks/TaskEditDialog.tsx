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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateTaskAction } from "@/lib/actions/admin-tasks";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { taskUpdateSchema, type TaskUpdateInput } from "@/lib/validations/tasks";
import type { TrainerTask } from "@/types/tasks";
import { TraineeSelect } from "./TraineeSelect";

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TrainerTask;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
}

/**
 * Admin edit of a single task. Unlike create, this targets exactly one assignee
 * — reassigning moves the task rather than fanning it out.
 *
 * The parent must pass `key={task.id}` so the form re-initialises when a
 * different task is opened: useState/defaultValues only run on mount.
 */
export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  trainers,
  trainees,
  today,
}: TaskEditDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof taskUpdateSchema>, unknown, TaskUpdateInput>({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: {
      taskId: task.id,
      title: task.title,
      description: task.description ?? "",
      assignedTo: task.assigned_to,
      traineeId: task.trainee_id,
      dueDate: task.due_date,
    },
  });

  const assignedTo = watch("assignedTo");
  const traineeId = watch("traineeId") ?? null;

  const onSubmit = async (data: TaskUpdateInput) => {
    setLoading(true);
    try {
      const result = await updateTaskAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("המשימה עודכנה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון המשימה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
          <DialogDescription>
            שינוי המאמן מעביר את המשימה אליו, ולא יוצר משימה נוספת.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("taskId")} />

          <div className="space-y-2">
            <Label htmlFor="edit-title">כותרת</Label>
            <Input id="edit-title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">פירוט (אופציונלי)</Label>
            <Textarea id="edit-description" rows={3} {...register("description")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-due-date">תאריך יעד</Label>
            {/*
              Same `min` as the create dialog. It is a UI hint, not a rule:
              backdating stays valid server-side so an admin can record a task
              that was genuinely due earlier, and the resulting "overdue" state
              is then correct rather than a bug.
            */}
            <Input
              id="edit-due-date"
              type="date"
              min={task.due_date < today ? task.due_date : today}
              {...register("dueDate")}
            />
            {errors.dueDate && (
              <p className="text-sm text-destructive">{errors.dueDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-assignee">מאמן אחראי</Label>
            <Select
              value={assignedTo}
              onValueChange={(value) =>
                setValue("assignedTo", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="edit-assignee">
                <SelectValue placeholder="בחירת מאמן" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.full_name ?? "ללא שם"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignedTo && (
              <p className="text-sm text-destructive">{errors.assignedTo.message}</p>
            )}
          </div>

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
              שמירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
