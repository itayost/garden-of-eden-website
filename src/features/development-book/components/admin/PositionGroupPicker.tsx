"use client";

import { cn } from "@/lib/utils";
import { POSITION_GROUPS, expandPositionGroup } from "@/features/development-book/lib/positions";
import type { CanonicalPosition } from "@/features/development-book/lib/types";

export interface PositionSelection {
  isAllPositions: boolean;
  positions: CanonicalPosition[];
}

interface PositionGroupPickerProps {
  value: PositionSelection;
  onChange: (value: PositionSelection) => void;
  disabled?: boolean;
}

export function PositionGroupPicker({
  value,
  onChange,
  disabled = false,
}: PositionGroupPickerProps) {
  function isGroupActive(groupKey: string): boolean {
    const group = POSITION_GROUPS.find((g) => g.key === groupKey);
    if (!group) return false;

    if (group.isAll) {
      return value.isAllPositions;
    }

    // A non-all group is active if every one of its positions is in the selected set
    return (
      !value.isAllPositions &&
      group.positions.length > 0 &&
      group.positions.every((pos) => value.positions.includes(pos))
    );
  }

  function handleGroupClick(groupKey: string) {
    const group = POSITION_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;

    if (group.isAll) {
      // Selecting "all" clears specific positions and sets is_all_positions = true
      onChange({ isAllPositions: true, positions: [] });
      return;
    }

    const groupPositions = expandPositionGroup(groupKey);

    if (isGroupActive(groupKey)) {
      // Toggle off: remove these positions from the selection
      const next = value.positions.filter((p) => !groupPositions.includes(p));
      onChange({ isAllPositions: false, positions: next });
    } else {
      // Toggle on: add these positions to the selection (deduplicated), clear all-positions
      const merged = [...new Set([...value.positions, ...groupPositions])] as CanonicalPosition[];
      onChange({ isAllPositions: false, positions: merged });
    }
  }

  return (
    <div className="flex flex-wrap gap-2" dir="rtl">
      {POSITION_GROUPS.map((group) => {
        const active = isGroupActive(group.key);
        return (
          <button
            key={group.key}
            type="button"
            disabled={disabled}
            onClick={() => handleGroupClick(group.key)}
            aria-pressed={active}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {group.labelHe}
          </button>
        );
      })}

      {!value.isAllPositions && value.positions.length > 0 && (
        <p className="w-full text-xs text-muted-foreground mt-1">
          עמדות נבחרות: {value.positions.join(", ")}
        </p>
      )}
    </div>
  );
}
