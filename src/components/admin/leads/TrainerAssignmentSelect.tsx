"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { LEAD_UNASSIGNED_VALUE } from "@/types/leads";

interface TrainerAssignmentSelectProps {
  trainers: TrainerOption[];
  value: string | null;
  onChange: (trainerId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}

/**
 * Trainer picker for lead assignment. Renders as a Select.
 * Includes an explicit "ללא שיוך" (unassigned) option.
 */
export function TrainerAssignmentSelect({
  trainers,
  value,
  onChange,
  disabled,
  placeholder = "בחר מאמן",
  triggerClassName,
}: TrainerAssignmentSelectProps) {
  const selectValue = value ?? LEAD_UNASSIGNED_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === LEAD_UNASSIGNED_VALUE ? null : v)}
      disabled={disabled}
      dir="rtl"
    >
      <SelectTrigger className={triggerClassName ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={LEAD_UNASSIGNED_VALUE}>ללא שיוך</SelectItem>
        {trainers.map((trainer) => (
          <SelectItem key={trainer.id} value={trainer.id}>
            {trainer.full_name || "מאמן ללא שם"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
