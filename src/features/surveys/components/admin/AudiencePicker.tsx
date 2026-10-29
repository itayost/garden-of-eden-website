"use client";

import { Loader2, Users } from "lucide-react";

import { BranchCheckboxGroup } from "@/features/branches/components/BranchCheckboxGroup";
import { cn } from "@/lib/utils";
import type { BranchOption } from "@/types/branches";
import { reachCount, reachText, yearChoices } from "../../lib/format";
import type { AudienceYearsState } from "./useAudienceYears";

interface AudiencePickerProps {
  /** Only the branches the viewer may choose. */
  branches: readonly BranchOption[];
  branchIds: readonly string[];
  birthYears: readonly number[];
  audience: AudienceYearsState;
  onBranchesChange: (next: string[]) => void;
  onYearsChange: (next: number[]) => void;
}

interface YearProps {
  birthYears: readonly number[];
  onChange: (next: number[]) => void;
}

type ReadyAudience = Extract<AudienceYearsState, { status: "ready" }>;

const byYear = (a: number, b: number) => a - b;

function YearToggles({ birthYears, audience, onChange }: YearProps & { audience: ReadyAudience }) {
  const choices = yearChoices(audience.years, birthYears);
  const toggle = (year: number) =>
    onChange(birthYears.includes(year) ? birthYears.filter((y) => y !== year) : [...birthYears, year].sort(byYear));

  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">אין חניכים פעילים בסניפים שנבחרו</p>;
  }
  return (
    <div role="group" aria-labelledby="audience-years-label" className="flex flex-wrap gap-1.5">
      {choices.map(({ year, count }) => {
        const on = birthYears.includes(year);
        return (
          <button
            key={year}
            type="button"
            aria-pressed={on}
            aria-label={`${year}, ${count} חניכים`}
            onClick={() => toggle(year)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
              on
                ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                : "bg-background text-foreground hover:bg-accent",
            )}
          >
            {year}
            <small className="text-xs font-normal text-muted-foreground">{count}</small>
          </button>
        );
      })}
    </div>
  );
}

function YearsArea({ audience, birthYears, onChange }: YearProps & { audience: AudienceYearsState }) {
  switch (audience.status) {
    case "idle":
      return <p className="text-sm text-muted-foreground">בחרו סניף כדי לבחור שנתונים</p>;
    case "loading":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          טוען...
        </p>
      );
    case "error":
      return (
        <p role="alert" className="text-sm text-destructive">
          {audience.message}
        </p>
      );
    case "ready":
      return <YearToggles birthYears={birthYears} audience={audience} onChange={onChange} />;
  }
}

/** The line that says how many active Trainees the Survey will reach, once that is known. */
function ReachLine({ audience, birthYears }: Pick<AudiencePickerProps, "audience" | "birthYears">) {
  if (audience.status !== "ready") return null;
  const count = reachCount(birthYears, audience.years, audience.total);
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground"
    >
      <Users aria-hidden="true" className="size-4 flex-none" />
      <span className="tabular-nums">{reachText(count)}</span>
    </div>
  );
}

/**
 * Who the Survey is for: branches (only those the viewer may choose), then,
 * optionally, birth years with each year's head count. No year ticked means
 * every year.
 */
export function AudiencePicker({
  branches,
  branchIds,
  birthYears,
  audience,
  onBranchesChange,
  onYearsChange,
}: AudiencePickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">סניפים</span>
        <BranchCheckboxGroup
          branches={branches}
          value={branchIds}
          onChange={onBranchesChange}
          idPrefix="survey-branch"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span id="audience-years-label" className="text-sm font-medium">
          שנתונים
        </span>
        <YearsArea birthYears={birthYears} audience={audience} onChange={onYearsChange} />
        <p className="text-xs text-muted-foreground">בלי סימון, הסקר נשלח לכל השנתונים</p>
      </div>
      <ReachLine audience={audience} birthYears={birthYears} />
    </div>
  );
}
