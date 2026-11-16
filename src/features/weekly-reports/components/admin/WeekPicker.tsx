"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportWeekLabel } from "../../lib/report-week";

interface WeekPickerProps {
  /** Report weeks (their Fridays), newest first. */
  weeks: readonly string[];
  /** The week in view. */
  value: string;
  /** The current Report week, marked in the list. */
  current: string;
  className?: string;
}

/**
 * The Report week in view, persisted as ?week=. A new week closes the open
 * report and goes back to the default tab. shallow: false re-renders the
 * server page, which loads the week.
 */
export function WeekPicker({ weeks, value, current, className = "w-full sm:w-56" }: WeekPickerProps) {
  const [, setQuery] = useQueryStates(
    { week: parseAsString, tab: parseAsString, report: parseAsString },
    { shallow: false },
  );

  return (
    <Select
      value={value}
      onValueChange={(week) => void setQuery({ week: week === current ? null : week, tab: null, report: null })}
    >
      <SelectTrigger className={className} aria-label="שבוע הדוח">
        <SelectValue placeholder="שבוע" />
      </SelectTrigger>
      <SelectContent>
        {weeks.map((week) => (
          <SelectItem key={week} value={week}>
            {reportWeekLabel(week)}
            {week === current ? " (השבוע האחרון)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
