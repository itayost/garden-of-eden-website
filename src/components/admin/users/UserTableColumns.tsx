"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { RoleBadge, StatusBadge } from "@/components/ui/badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProfileWithBranches } from "@/types/branches";
import { NO_BRANCH_LABEL_HE } from "@/types/branches";
import { PlanStatusBadge } from "@/features/plans/components/PlanStatusBadge";
import { formatPhoneToLocal } from "@/lib/validations/common";

/**
 * Get initials from full name for avatar fallback
 * Returns up to 2 uppercase letters
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const selectColumn: ColumnDef<ProfileWithBranches> = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
      aria-label="בחר את כל השורות בעמוד"
      onClick={(e) => e.stopPropagation()}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(value === true)}
      aria-label="בחר שורה"
      onClick={(e) => e.stopPropagation()}
    />
  ),
  enableSorting: false,
};

const baseColumns: ColumnDef<ProfileWithBranches>[] = [
  {
    id: "avatar",
    header: "",
    cell: ({ row }) => (
      <Avatar className="h-8 w-8">
        <AvatarImage src={row.original.avatar_url || undefined} />
        <AvatarFallback>{getInitials(row.original.full_name)}</AvatarFallback>
      </Avatar>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        שם
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className={row.original.deleted_at ? "text-muted-foreground line-through" : ""}>
        {row.getValue("full_name") || "לא צוין"}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "טלפון",
    cell: ({ row }) => (
      <span dir="ltr" className="text-right">
        {formatPhoneToLocal(row.getValue("phone")) || "-"}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        תפקיד
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <RoleBadge role={row.getValue("role")} />,
  },
  {
    id: "branches",
    header: "סניף",
    cell: ({ row }) =>
      row.original.branchNames.length === 0 ? (
        <span className="text-xs text-muted-foreground">{NO_BRANCH_LABEL_HE}</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.branchNames.map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      ),
    enableSorting: false,
  },
  {
    accessorKey: "is_active",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        סטטוס
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <StatusBadge isActive={row.getValue("is_active")} />,
  },
  {
    id: "plan",
    header: "מסלול",
    cell: ({ row }) => {
      const badge = row.original.planBadge;
      // endsOn is empty for the medical-only marker: no plan to show.
      if (!badge || !badge.endsOn) {
        return <span className="text-xs text-muted-foreground">-</span>;
      }
      return (
        <div className="flex items-center gap-1.5">
          <PlanStatusBadge status={badge.status} className="text-xs" />
          {badge.sessionsLeft !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {badge.sessionsLeft} נותרו
            </span>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
];

/** The row-selection column is admin-only: it feeds the bulk branch assign bar. */
export function getUserColumns({
  selectable,
}: {
  selectable: boolean;
}): ColumnDef<ProfileWithBranches>[] {
  return selectable ? [selectColumn, ...baseColumns] : baseColumns;
}
