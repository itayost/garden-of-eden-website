"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface VideoTableToolbarProps {
  onSearchChange: (value: string) => void;
  onDayFilterChange: (value: number | null) => void;
}

/**
 * Toolbar component for the video data table
 * Provides search input and day filter select
 * Follows the UserTableToolbar.tsx pattern with debounced search
 */
export function VideoTableToolbar({
  onSearchChange,
  onDayFilterChange,
}: VideoTableToolbarProps) {
  // Local state for controlled input (to avoid lag from debouncing)
  const [searchInput, setSearchInput] = useState("");

  // Debounced search to avoid too many filter updates
  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
  }, 300);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Handle day filter change
  const handleDayChange = (value: string) => {
    const newDay = value === "all" ? null : parseInt(value, 10);
    onDayFilterChange(newDay);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      {/* Search Input */}
      <div className="relative w-full md:w-64">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי כותרת..."
          value={searchInput}
          onChange={handleSearchChange}
          className="pr-9"
        />
      </div>

      {/* Day Filter */}
      <Select defaultValue="all" onValueChange={handleDayChange}>
        <SelectTrigger className="w-full md:w-32">
          <SelectValue placeholder="כל הימים" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הימים</SelectItem>
          <SelectItem value="1">יום 1</SelectItem>
          <SelectItem value="2">יום 2</SelectItem>
          <SelectItem value="3">יום 3</SelectItem>
          <SelectItem value="4">יום 4</SelectItem>
          <SelectItem value="5">יום 5</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
