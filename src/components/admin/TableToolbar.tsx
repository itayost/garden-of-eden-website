"use client";

import { useState, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// =============================================================================
// Main TableToolbar
// =============================================================================

interface TableToolbarProps {
  /** Current search value (controlled by parent, typically via nuqs) */
  searchValue: string;
  /** Called with debounced search value */
  onSearchChange: (value: string) => void;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Filter components (ToolbarSelect, ToolbarCheckbox, ToolbarDateRange) */
  filters?: React.ReactNode;
  /** Action buttons (export, create, etc.) — rendered on the right */
  actions?: React.ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "חיפוש...",
  filters,
  actions,
}: TableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
  }, 300);

  // Sync external changes (e.g., browser back/forward) to local state
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    debouncedSearch(value);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={handleSearchChange}
            className="pr-9"
          />
        </div>

        {/* Filter Slots */}
        {filters}
      </div>

      {/* Action Buttons */}
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

// =============================================================================
// ToolbarSelect — Dropdown filter
// =============================================================================

interface ToolbarSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function ToolbarSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className = "w-full md:w-40",
}: ToolbarSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// =============================================================================
// ToolbarCheckbox — Boolean toggle filter
// =============================================================================

interface ToolbarCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

export function ToolbarCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
}: ToolbarCheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val === true)}
      />
      <Label htmlFor={id} className="text-sm cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

// =============================================================================
// ToolbarDateRange — Date range filter
// =============================================================================

interface ToolbarDateRangeProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startLabel?: string;
  endLabel?: string;
}

export function ToolbarDateRange({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = "מתאריך",
  endLabel = "עד תאריך",
}: ToolbarDateRangeProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">{startLabel}</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">{endLabel}</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>
    </>
  );
}
