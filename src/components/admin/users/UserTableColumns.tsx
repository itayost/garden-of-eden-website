"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { RoleBadge, StatusBadge } from "@/components/ui/badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

/**
 * Format phone number for display
 * Converts +972XXXXXXXXX to 0XXXXXXXXX format
 */
function formatPhone(phone: string | null): string {
  if (!phone) return "-";
  if (phone.startsWith("+972")) {
    return "0" + phone.slice(4);
  }
  return phone;
}

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

export const columns: ColumnDef<Profile>[] = [
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
        {formatPhone(row.getValue("phone"))}
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
    id: "payment_status",
    header: "תשלום",
    cell: () => (
      <Badge variant="outline" className="text-muted-foreground">
        -
      </Badge>
    ),
    enableSorting: false,
  },
];
