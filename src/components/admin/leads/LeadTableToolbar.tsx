"use client";

import { useState, useEffect, useRef } from "react";
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
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/leads";
import { TEAMS } from "@/lib/whatsapp/flow-constants";

interface LeadTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onHaifaChange: (value: boolean) => void;
  onTeamChange: (value: string | null) => void;
  onFlowChange: (value: string | null) => void;
  onCreateClick: () => void;
  statusValue?: string | null;
}

export function LeadTableToolbar({
  onSearchChange,
  onStatusChange,
  onHaifaChange,
  onTeamChange,
  onFlowChange,
  onCreateClick,
  statusValue,
}: LeadTableToolbarProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString);
  const [haifa, setHaifa] = useQueryState(
    "haifa",
    parseAsBoolean.withDefault(false)
  );
  const [team, setTeam] = useQueryState("team", parseAsString);
  const [flow, setFlow] = useQueryState("flow", parseAsString);
  const [searchInput, setSearchInput] = useState(search);
  const isExternalUpdate = useRef(false);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    onSearchChange(value);
  }, 300);

  // Sync external statusValue (from stat card clicks) into nuqs
  useEffect(() => {
    if (statusValue !== undefined && statusValue !== status) {
      isExternalUpdate.current = true;
      setStatus(statusValue);
    }
  }, [statusValue, status, setStatus]);

  useEffect(() => {
    onSearchChange(search);
  }, [search, onSearchChange]);
  useEffect(() => {
    if (isExternalUpdate.current) {
      isExternalUpdate.current = false;
      return;
    }
    onStatusChange(status);
  }, [status, onStatusChange]);
  useEffect(() => {
    onHaifaChange(haifa);
  }, [haifa, onHaifaChange]);
  useEffect(() => {
    onTeamChange(team);
  }, [team, onTeamChange]);
  useEffect(() => {
    onFlowChange(flow);
  }, [flow, onFlowChange]);

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

  const handleTeamChange = (value: string) => {
    const newTeam = value === "all" ? null : value;
    setTeam(newTeam);
    onTeamChange(newTeam);
  };

  const handleFlowChange = (value: string) => {
    const newFlow = value === "all" ? null : value;
    setFlow(newFlow);
    onFlowChange(newFlow);
  };

  const hasActiveFilters =
    search || status || haifa || team || flow;

  const handleClearFilters = () => {
    setSearchInput("");
    setSearch(null);
    setStatus(null);
    setHaifa(null);
    setTeam(null);
    setFlow(null);
    onSearchChange("");
    onStatusChange(null);
    onHaifaChange(false);
    onTeamChange(null);
    onFlowChange(null);
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
