"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export const columns: ColumnDef<Lead>[] = [
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
    accessorKey: "is_from_haifa",
    header: "חיפה",
    cell: ({ row }) =>
      row.getValue("is_from_haifa") ? (
        <Badge variant="outline" className="bg-purple-100 text-purple-800">
          חיפה
        </Badge>
      ) : null,
    enableSorting: false,
  },
  {
    accessorKey: "payment",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        תשלום
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const payment = row.original.payment;
      return payment ? `${payment.toLocaleString()}₪` : "—";
    },
  },
  {
    accessorKey: "total_payment",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        סה״כ
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const total = row.original.total_payment;
      return total ? (
        <span className="font-bold text-green-700">
          {total.toLocaleString()}₪
        </span>
      ) : (
        "—"
      );
    },
  },
  {
    id: "flow",
    header: "Flow",
    cell: ({ row }) => {
      const hasFlow = row.original.flow_age_group !== null;
      return hasFlow ? (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          ✓ הושלם
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          ממתין
        </Badge>
      );
    },
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
  },
];
