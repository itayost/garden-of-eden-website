"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { TASK_NO_TRAINEE_VALUE } from "@/types/tasks";

interface TraineeSelectProps {
  trainees: TrainerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Optional trainee link on a task.
 *
 * This is a context tag for staff only. The linked trainee gets no access to
 * the task and never sees it, so the task text can hold internal notes.
 */
export function TraineeSelect({ trainees, value, onChange }: TraineeSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="task-trainee">מתאמן משוייך (אופציונלי)</Label>
      <Select
        value={value ?? TASK_NO_TRAINEE_VALUE}
        onValueChange={(next) =>
          onChange(next === TASK_NO_TRAINEE_VALUE ? null : next)
        }
      >
        <SelectTrigger id="task-trainee">
          <SelectValue placeholder="ללא" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TASK_NO_TRAINEE_VALUE}>ללא</SelectItem>
          {trainees.map((trainee) => (
            <SelectItem key={trainee.id} value={trainee.id}>
              {trainee.full_name ?? "ללא שם"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        לתיוג פנימי בלבד. המתאמן לא רואה את המשימה.
      </p>
    </div>
  );
}
