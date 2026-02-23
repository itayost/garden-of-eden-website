"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import type { AgeGroupOption } from "../types";

interface AgeGroupFilterProps {
  selectedAgeGroup: string;
  availableAgeGroups: AgeGroupOption[];
  onAgeGroupChange: (ageGroupId: string) => void;
}

export function AgeGroupFilter({
  selectedAgeGroup,
  availableAgeGroups,
  onAgeGroupChange,
}: AgeGroupFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedAgeGroup} onValueChange={onAgeGroupChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="בחר קבוצת גיל" />
        </SelectTrigger>
        <SelectContent>
          {availableAgeGroups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
