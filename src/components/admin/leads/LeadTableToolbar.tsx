"use client";

import { useState, useEffect } from "react";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import { useDebouncedCallback } from "use-debounce";
import { Search, Plus, X } from "lucide-react";
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
import { LEAD_STATUS_LABELS, LEAD_UNASSIGNED_VALUE, type LeadStatus } from "@/types/leads";
import { TEAMS } from "@/lib/whatsapp/flow-constants";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface LeadTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onHaifaChange: (value: boolean) => void;
  onTeamChange: (value: string | null) => void;
  onFlowChange: (value: string | null) => void;
  onAssignedTrainerChange: (value: string | null) => void;
  onCreateClick: () => void;
  statusValue?: string | null;
  trainers: TrainerOption[];
}

export function LeadTableToolbar({
  onSearchChange,
  onStatusChange,
  onHaifaChange,
  onTeamChange,
  onFlowChange,
  onAssignedTrainerChange,
  onCreateClick,
  statusValue,
  trainers,
}: LeadTableToolbarProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString);
  const [haifa, setHaifa] = useQueryState(
    "haifa",
    parseAsBoolean.withDefault(false)
  );
  const [team, setTeam] = useQueryState("team", parseAsString);
  const [flow, setFlow] = useQueryState("flow", parseAsString);
  const [assignedTrainer, setAssignedTrainer] = useQueryState("at", parseAsString);
  const [searchInput, setSearchInput] = useState(search);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    onSearchChange(value);
  }, 300);

  // Sync external statusValue (from stat card clicks) into nuqs.
  // The parent already has the new value; we only mirror it into the URL.
  useEffect(() => {
    if (statusValue !== undefined && statusValue !== status) {
      setStatus(statusValue);
    }
  }, [statusValue, status, setStatus]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Factory for Select filters whose "all" sentinel maps to null in both
  // the URL state (nuqs setter) and the parent callback.
  const makeSelectHandler =
    (
      setter: (next: string | null) => void,
      callback: (next: string | null) => void,
    ) =>
    (value: string) => {
      const next = value === "all" ? null : value;
      setter(next);
      callback(next);
    };

  const handleStatusChange = makeSelectHandler(setStatus, onStatusChange);
  const handleTeamChange = makeSelectHandler(setTeam, onTeamChange);
  const handleFlowChange = makeSelectHandler(setFlow, onFlowChange);
  const handleAssignedTrainerChange = makeSelectHandler(
    setAssignedTrainer,
    onAssignedTrainerChange,
  );

  const handleHaifaChange = (checked: boolean) => {
    setHaifa(checked || null);
    onHaifaChange(checked);
  };

  const hasActiveFilters =
    search || status || haifa || team || flow || assignedTrainer;

  const handleClearFilters = () => {
    setSearchInput("");
    setSearch(null);
    setStatus(null);
    setHaifa(null);
    setTeam(null);
    setFlow(null);
    setAssignedTrainer(null);
    onSearchChange("");
    onStatusChange(null);
    onHaifaChange(false);
    onTeamChange(null);
    onFlowChange(null);
    onAssignedTrainerChange(null);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center md:flex-wrap">
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
        <Select value={team || "all"} onValueChange={handleTeamChange}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="קבוצה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקבוצות</SelectItem>
            {TEAMS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={flow || "all"} onValueChange={handleFlowChange}>
          <SelectTrigger className="w-full md:w-36">
            <SelectValue placeholder="Flow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="complete">הושלם</SelectItem>
            <SelectItem value="pending">ממתין</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={assignedTrainer || "all"}
          onValueChange={handleAssignedTrainerChange}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="מאמן משוייך" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המאמנים</SelectItem>
            <SelectItem value={LEAD_UNASSIGNED_VALUE}>ללא שיוך</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.full_name || "מאמן ללא שם"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 ml-1" />
            נקה פילטרים
          </Button>
        )}
      </div>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 ml-2" />
        ליד חדש
      </Button>
    </div>
  );
}
