"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { BranchOption } from "@/types/branches";

interface BranchCheckboxGroupProps {
  branches: readonly BranchOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * One checkbox per active branch. Zero, one or all may be checked: a user
 * with no branch is legitimate during rollout, and a dual-branch user is the
 * whole reason this is not a select.
 */
export function BranchCheckboxGroup({
  branches,
  value,
  onChange,
  disabled = false,
  idPrefix = "branch",
}: BranchCheckboxGroupProps) {
  const toggle = (branchId: string, checked: boolean) => {
    const without = value.filter((id) => id !== branchId);
    onChange(checked ? [...without, branchId] : without);
  };

  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">אין סניפים פעילים</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {branches.map((branch) => {
        const id = `${idPrefix}-${branch.id}`;
        return (
          <div key={branch.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value.includes(branch.id)}
              onCheckedChange={(checked) => toggle(branch.id, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={id} className="cursor-pointer">
              {branch.nameHe}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
