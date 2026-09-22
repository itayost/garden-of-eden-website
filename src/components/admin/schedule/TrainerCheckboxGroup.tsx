"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface TrainerCheckboxGroupProps {
  trainers: readonly TrainerOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * One checkbox per trainer. Zero, one or several may be checked: an hour with
 * nobody assigned is legitimate, and an hour with two is the whole reason this
 * is not a select.
 *
 * Ticking appends rather than sorting, because selection order is the order on
 * the card and the first of them is what gives the card its colour.
 */
export function TrainerCheckboxGroup({
  trainers,
  value,
  onChange,
  disabled = false,
  idPrefix = "trainer",
}: TrainerCheckboxGroupProps) {
  const toggle = (trainerId: string, checked: boolean) => {
    const without = value.filter((id) => id !== trainerId);
    onChange(checked ? [...without, trainerId] : without);
  };

  if (trainers.length === 0) {
    return <p className="text-sm text-muted-foreground">אין מאמנים פעילים</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {trainers.map((trainer) => {
        const id = `${idPrefix}-${trainer.id}`;
        return (
          <div key={trainer.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value.includes(trainer.id)}
              onCheckedChange={(checked) => toggle(trainer.id, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={id} className="cursor-pointer">
              {trainer.full_name ?? "ללא שם"}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
