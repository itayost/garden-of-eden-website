"use client";

import { useState } from "react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Search } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import type { BranchOption } from "@/types/branches";
import { MAX_SEARCH_LENGTH, REPORT_SEGMENTS } from "../../lib/report-filters";
import type { ReportSegment } from "../../lib/report";
import { yearOptions } from "../../lib/results-view";
import { SegmentedRadioGroup } from "./SegmentedRadioGroup";

const SEARCH_DEBOUNCE_MS = 300;
const ALL_YEARS = "all";

const SEGMENT_LABELS: Record<ReportSegment, string> = {
  answered: "ענו",
  seen: "ראו ולא ענו",
  unseen: "לא ראו",
};

/**
 * The page's own parameters. Every filter change goes through setFilters,
 * which also clears `page` in the same URL update, so a changed view never
 * lands on a page it may not have. shallow: false makes nuqs re-render the
 * server page, which builds the report.
 */
const PARAMS = {
  segment: parseAsStringLiteral(REPORT_SEGMENTS).withDefault("answered"),
  q: parseAsString.withDefault(""),
  year: parseAsInteger,
  page: parseAsInteger,
};

interface ResultsToolbarProps {
  /** From the report's totals, so the search never changes them. */
  counts: Record<ReportSegment, number>;
  /** The branches the viewer may filter by; the filter is left out for one or none. */
  branches: BranchOption[];
  birthYears: readonly number[];
}

function SegmentControl({
  segment,
  counts,
  onChange,
}: {
  segment: ReportSegment;
  counts: Record<ReportSegment, number>;
  onChange: (segment: ReportSegment) => void;
}) {
  return (
    <SegmentedRadioGroup
      label="תצוגה"
      options={REPORT_SEGMENTS}
      value={segment}
      onChange={onChange}
      renderOption={(value) => (
        <>
          {SEGMENT_LABELS[value]} <span className="tabular-nums">{counts[value]}</span>
        </>
      )}
      className="flex w-full md:inline-flex md:w-auto"
      itemClassName="flex-1 whitespace-nowrap text-center md:flex-none"
    />
  );
}

function YearSelect({
  year,
  birthYears,
  onChange,
}: {
  year: number | null;
  birthYears: readonly number[];
  onChange: (year: number | null) => void;
}) {
  return (
    <Select
      value={year === null ? ALL_YEARS : String(year)}
      onValueChange={(value) => onChange(value === ALL_YEARS ? null : Number(value))}
    >
      <SelectTrigger className="w-full md:w-40" aria-label="שנתון">
        <SelectValue placeholder="כל השנתונים" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_YEARS}>כל השנתונים</SelectItem>
        {yearOptions(birthYears, year).map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The name box: it types at once and writes the address after a pause. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  // Back and forward move the address, and the box follows it.
  if (value !== seenValue) {
    setSeenValue(value);
    setText(value);
  }
  const commit = useDebouncedCallback(onCommit, SEARCH_DEBOUNCE_MS);

  return (
    <div className="relative col-span-2 md:col-span-1 md:w-52">
      <Search
        aria-hidden="true"
        className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={text}
        maxLength={MAX_SEARCH_LENGTH}
        placeholder="חיפוש חניך"
        aria-label="חיפוש חניך"
        className="ps-9"
        onChange={(event) => {
          setText(event.target.value);
          commit(event.target.value);
        }}
      />
    </div>
  );
}

/** What a filter change can set; the branch is written by BranchUrlFilter itself. */
interface FilterPatch {
  segment?: ReportSegment;
  q?: string | null;
  year?: number | null;
}

/** Segment, name search, branch and birth year, all in the URL; every change goes back to page 1. */
export function ResultsToolbar({ counts, branches, birthYears }: ResultsToolbarProps) {
  const [params, setParams] = useQueryStates(PARAMS, { shallow: false });
  const setFilters = (patch: FilterPatch) => void setParams({ ...patch, page: null });

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <SegmentControl
        segment={params.segment}
        counts={counts}
        onChange={(segment) => setFilters({ segment })}
      />
      <div className="grid grid-cols-2 gap-2 md:ms-auto md:flex md:items-center">
        <SearchBox
          value={params.q}
          onCommit={(value) => setFilters({ q: value.trim() === "" ? null : value })}
        />
        {branches.length > 1 && (
          <BranchUrlFilter branches={branches} className="w-full md:w-40" onChange={() => setFilters({})} />
        )}
        {birthYears.length > 0 && (
          <YearSelect year={params.year} birthYears={birthYears} onChange={(year) => setFilters({ year })} />
        )}
      </div>
    </div>
  );
}
