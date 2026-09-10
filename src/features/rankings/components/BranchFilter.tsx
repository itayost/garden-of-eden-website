"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import type { BranchOption } from "@/types/branches";
import { ALL_BRANCHES } from "../lib/config/branches";

interface BranchFilterProps {
  selectedBranch: string;
  options: BranchOption[];
  showAllOption: boolean;
  onBranchChange: (branchId: string) => void;
}

export function BranchFilter({
  selectedBranch,
  options,
  showAllOption,
  onBranchChange,
}: BranchFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedBranch} onValueChange={onBranchChange}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="סניף">
          <SelectValue placeholder="סניף" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && <SelectItem value={ALL_BRANCHES}>כל הסניפים</SelectItem>}
          {options.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
