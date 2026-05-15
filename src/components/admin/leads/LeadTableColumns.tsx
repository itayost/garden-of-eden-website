"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import type { Lead } from "@/types/leads";

function formatPhone(phone: string): string {
  if (phone.startsWith("972")) {
    const local = "0" + phone.slice(3);
    return local.slice(0, 3) + "-" + local.slice(3);
  }
  return phone;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("he-IL");
}

function truncate(value: string | null, max = 40): string {
  if (!value) return "";
  return value.length > max ? value.slice(0, max) + "…" : value;
}

interface GetLeadColumnsOptions {
  showPaidIndicator: boolean;
}

export function getLeadColumns({ showPaidIndicator }: GetLeadColumnsOptions): ColumnDef<Lead>[] {
  const cols: ColumnDef<Lead>[] = [];

  if (showPaidIndicator) {
    cols.push({
      id: "paid",
      header: "שולם",
      cell: ({ row }) => {
        const paid = (row.original.payment ?? 0) > 0;
        return paid ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="שולם" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" aria-label="לא שולם" />
        );
      },
      enableSorting: false,
    });
  }

  cols.push(
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          שם
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
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
      accessorKey: "club",
      header: "מועדון",
      cell: ({ row }) => row.original.club || "—",
      enableSorting: false,
    },
    {
      accessorKey: "birth_year",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          שנתון
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.birth_year ?? "—",
    },
    {
      accessorKey: "additional_info",
      header: "מידע נוסף",
      cell: ({ row }) => (
        <span className="text-muted-foreground" title={row.original.additional_info ?? undefined}>
          {truncate(row.original.additional_info) || "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "assigned_trainer",
      header: "משוייך למאמן",
      cell: ({ row }) => row.original.assigned_trainer?.full_name || "—",
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          סטטוס
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <LeadStatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "note",
      header: "הערות",
      cell: ({ row }) => (
        <span className="text-muted-foreground" title={row.original.note ?? undefined}>
          {truncate(row.original.note) || "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          תאריך
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.getValue("created_at")),
    }
  );

  return cols;
}
