"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DateRangePreset } from "../types";
import { DATE_RANGE_PRESETS } from "../lib/config/metric-definitions";

interface DateRangeFilterProps {
  selected: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
}

export function DateRangeFilter({ selected, onChange }: DateRangeFilterProps) {
  return (
    <Tabs
      value={selected}
      onValueChange={(v) => onChange(v as DateRangePreset)}
      dir="rtl"
    >
      <TabsList className="h-8">
        {DATE_RANGE_PRESETS.map((preset) => (
          <TabsTrigger
            key={preset.value}
            value={preset.value}
            className="text-xs px-3"
          >
            {preset.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
