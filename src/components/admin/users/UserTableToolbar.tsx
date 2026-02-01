"use client";

import { useEffect, useState } from "react";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UserPlus, Search } from "lucide-react";
import Link from "next/link";

interface UserTableToolbarProps {
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string | null) => void;
  onStatusChange: (value: string | null) => void;
  onShowDeletedChange: (value: boolean) => void;
}

/**
 * Toolbar component for the user data table
 * Provides search, role filter, status filter, show deleted toggle, and create button
 * All filter state is persisted in URL via nuqs
 */
export function UserTableToolbar({
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onShowDeletedChange,
}: UserTableToolbarProps) {
  // URL state management with nuqs
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [role, setRole] = useQueryState("role", parseAsString);
  const [status, setStatus] = useQueryState("status", parseAsString);
  const [showDeleted, setShowDeleted] = useQueryState(
    "deleted",
    parseAsBoolean.withDefault(false)
  );

  // Local state for controlled input (to avoid lag from URL updates)
  const [searchInput, setSearchInput] = useState(search);

  // Debounced search to avoid too many URL updates
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    onSearchChange(value);
  }, 300);

  // Sync URL state to parent on mount and when URL changes
  useEffect(() => {
    onSearchChange(search);
  }, [search, onSearchChange]);

  useEffect(() => {
    onRoleChange(role);
  }, [role, onRoleChange]);

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    onShowDeletedChange(showDeleted);
  }, [showDeleted, onShowDeletedChange]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Handle role filter change
  const handleRoleChange = (value: string) => {
    const newRole = value === "all" ? null : value;
    setRole(newRole);
    onRoleChange(newRole);
  };

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    const newStatus = value === "all" ? null : value;
    setStatus(newStatus);
    onStatusChange(newStatus);
  };

  // Handle show deleted toggle
  const handleShowDeletedChange = (checked: boolean) => {
    setShowDeleted(checked || null);
    onShowDeletedChange(checked);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search and Filters */}
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או טלפון..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pr-9"
          />
        </div>

        {/* Role Filter */}
        <Select value={role || "all"} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="תפקיד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל התפקידים</SelectItem>
            <SelectItem value="admin">מנהל</SelectItem>
            <SelectItem value="trainer">מאמן</SelectItem>
            <SelectItem value="trainee">מתאמן</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>

        {/* Show Deleted Toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-deleted"
            checked={showDeleted}
            onCheckedChange={(checked) =>
              handleShowDeletedChange(checked === true)
            }
          />
          <Label htmlFor="show-deleted" className="text-sm cursor-pointer">
            הצג מחוקים
          </Label>
        </div>
      </div>

      {/* Create User Button */}
      <Button asChild>
        <Link href="/admin/users/create">
          <UserPlus className="h-4 w-4" />
          יצירת משתמש
        </Link>
      </Button>
    </div>
  );
}
