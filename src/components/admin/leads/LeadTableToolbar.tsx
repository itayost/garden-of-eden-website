"use client";

import { useState, useEffect } from "react";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import { useDebouncedCallback } from "use-debounce";
import { Search, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/leads";

interface LeadTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onHaifaChange: (value: boolean) => void;
  onCreateClick: () => void;
}

export function LeadTableToolbar({
  onSearchChange,
  onStatusChange,
  onHaifaChange,
  onCreateClick,
}: LeadTableToolbarProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString);
  const [haifa, setHaifa] = useQueryState(
    "haifa",
    parseAsBoolean.withDefault(false)
  );
  const [searchInput, setSearchInput] = useState(search);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    onSearchChange(value);
  }, 300);

  useEffect(() => {
    onSearchChange(search);
  }, [search, onSearchChange]);
  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);
  useEffect(() => {
    onHaifaChange(haifa);
  }, [haifa, onHaifaChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const handleStatusChange = (value: string) => {
    const newStatus = value === "all" ? null : value;
    setStatus(newStatus);
    onStatusChange(newStatus);
  };

  const handleHaifaChange = (checked: boolean) => {
    setHaifa(checked || null);
    onHaifaChange(checked);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או טלפון..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pr-9"
          />
        </div>
        <Select value={status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {(
              Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="haifa-filter"
            checked={haifa}
            onCheckedChange={(checked) =>
              handleHaifaChange(checked === true)
            }
          />
          <Label htmlFor="haifa-filter" className="text-sm cursor-pointer">
            מחיפה בלבד
          </Label>
        </div>
      </div>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 ml-2" />
        ליד חדש
      </Button>
    </div>
  );
}
