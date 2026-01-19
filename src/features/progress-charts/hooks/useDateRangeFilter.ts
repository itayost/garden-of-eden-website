"use client";

import { useState, useMemo, useCallback } from "react";
import type { DateRange, DateRangePreset } from "../types";
import { calculateDateFromPreset, filterByDateRange } from "../lib/utils";

/**
 * Hook for managing date range filter state
 */
export function useDateRangeFilter(defaultPreset: DateRangePreset = "6m") {
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: calculateDateFromPreset(defaultPreset),
    to: new Date(),
    preset: defaultPreset,
  }));

  const setPreset = useCallback((preset: DateRangePreset) => {
    setDateRange({
      from: calculateDateFromPreset(preset),
      to: new Date(),
      preset,
    });
  }, []);

  const filter = useMemo(() => {
    return <T extends { date: string }>(items: T[]): T[] => {
      return filterByDateRange(items, dateRange);
    };
  }, [dateRange]);

  return {
    dateRange,
    preset: dateRange.preset,
    setPreset,
    filter,
  };
}
