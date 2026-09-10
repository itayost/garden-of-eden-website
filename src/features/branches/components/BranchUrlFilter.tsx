"use client";

import { useQueryState, parseAsString } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRANCH_FILTER_ALL } from "@/lib/admin/branch-filter";
import type { BranchOption } from "@/types/branches";

interface BranchUrlFilterProps {
  branches: BranchOption[];
  className?: string;
}

/**
 * "All branches" plus one entry per active branch, persisted as ?branch=.
 * shallow: false makes nuqs re-render the server page, which is what a
 * server-rendered list needs to pick the filter up.
 */
export function BranchUrlFilter({
  branches,
  className = "w-full md:w-40",
}: BranchUrlFilterProps) {
  const [branch, setBranch] = useQueryState(
    "branch",
    parseAsString.withDefault(BRANCH_FILTER_ALL).withOptions({ shallow: false }),
  );

  return (
    <Select
      value={branch}
      onValueChange={(v) => setBranch(v === BRANCH_FILTER_ALL ? null : v)}
    >
      <SelectTrigger className={className} aria-label="סניף">
        <SelectValue placeholder="סניף" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BRANCH_FILTER_ALL}>כל הסניפים</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.nameHe}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
