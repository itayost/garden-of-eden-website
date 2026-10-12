"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToolbarDateRange } from "@/components/admin/TableToolbar";
import { cn } from "@/lib/utils";
import { isValidDateString } from "@/lib/validations/common";
import type { RangePreset, ReportRange } from "../lib/range";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "day", label: "היום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "custom", label: "טווח" },
];

/**
 * A date input reports every keystroke: typing a year passes through 0002-,
 * 0020- and 0202-. Only a full date from this century moves the report, so
 * the page does not clip the half-typed range and reset the field.
 */
const isSettledDate = (value: string) => isValidDateString(value) && value >= "2000-01-01";

/** Both ends settled and in order: a reversed range mid-edit would fall back to "day". */
const isSettledRange = (from: string, to: string) => isSettledDate(from) && isSettledDate(to) && from <= to;

/** Day, week, month or a typed range, kept in the URL so the server page reads it. */
export function RangeControl({ range }: { range: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const go = (next: Record<string, string | null>) => {
    const entries = [...search.entries()].filter(([key]) => !(key in next));
    const added = Object.entries(next).filter((entry): entry is [string, string] => entry[1] !== null);
    router.push(`${pathname}?${new URLSearchParams([...entries, ...added]).toString()}`);
  };

  const choose = (preset: RangePreset) => {
    if (preset === "day") go({ range: null, from: null, to: null });
    else if (preset === "custom") go({ range: "custom", from, to });
    else go({ range: preset, from: null, to: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="טווח הדוח" className="inline-flex gap-0.5 rounded-lg bg-muted p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={range.preset === p.value}
            onClick={() => choose(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              range.preset === p.value && "bg-card text-foreground shadow-sm",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {range.preset === "custom" && (
        <ToolbarDateRange
          startDate={from}
          endDate={to}
          onStartDateChange={(value) => {
            setFrom(value);
            if (isSettledRange(value, to)) go({ range: "custom", from: value, to });
          }}
          onEndDateChange={(value) => {
            setTo(value);
            if (isSettledRange(from, value)) go({ range: "custom", from, to: value });
          }}
        />
      )}
    </div>
  );
}
