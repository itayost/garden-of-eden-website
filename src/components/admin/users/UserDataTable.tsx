"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleBadge, StatusBadge } from "@/components/ui/badges";
import { columns } from "./UserTableColumns";
import { UserTableToolbar } from "./UserTableToolbar";
import { UserTablePagination } from "./UserTablePagination";
import type { Profile } from "@/types/database";

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  if (phone.startsWith("+972")) return "0" + phone.slice(4);
  return phone;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

interface UserDataTableProps {
  data: Profile[];
  initialSearch?: string;
  initialRole?: string | null;
  initialStatus?: string | null;
  initialShowDeleted?: boolean;
  isAdmin?: boolean;
}

/**
 * Main data table component for admin user list
 * Integrates TanStack Table with toolbar filters and pagination
 * Handles row click navigation to user profile page
 */
export function UserDataTable({
  data,
  initialSearch = "",
  initialRole = null,
  initialStatus = null,
  initialShowDeleted = false,
  isAdmin = true,
}: UserDataTableProps) {
  const router = useRouter();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Filter state (controlled by toolbar, synced with URL)
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<string | null>(initialRole);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialStatus);
  const [showDeleted, setShowDeleted] = useState(initialShowDeleted);

  // Memoized filtered data based on all criteria
  const filteredData = useMemo(() => {
    return data.filter((user) => {
      // Hide deleted by default (unless showDeleted is true)
      if (!showDeleted && user.deleted_at) return false;

      // Global search (matches name or phone)
      if (globalFilter) {
        const searchLower = globalFilter.toLowerCase();
        const matchesName = user.full_name?.toLowerCase().includes(searchLower);
        const matchesPhone = user.phone?.includes(globalFilter);
        if (!matchesName && !matchesPhone) return false;
      }

      // Role filter
      if (roleFilter && user.role !== roleFilter) return false;

      // Status filter (active/inactive)
      if (statusFilter) {
        const isActive = user.is_active;
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "inactive" && isActive) return false;
      }

      return true;
    });
  }, [data, globalFilter, roleFilter, statusFilter, showDeleted]);

  // Initialize TanStack Table
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // Handle row click - navigate to user profile
  const handleRowClick = useCallback(
    (userId: string) => {
      router.push(`/admin/users/${userId}`);
    },
    [router]
  );

  // Toolbar callbacks (memoized to prevent unnecessary rerenders)
  const handleSearchChange = useCallback((value: string) => {
    setGlobalFilter(value);
  }, []);

  const handleRoleChange = useCallback((value: string | null) => {
    setRoleFilter(value);
  }, []);

  const handleStatusChange = useCallback((value: string | null) => {
    setStatusFilter(value);
  }, []);

  const handleShowDeletedChange = useCallback((value: boolean) => {
    setShowDeleted(value);
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <UserTableToolbar
        onSearchChange={handleSearchChange}
        onRoleChange={handleRoleChange}
        onStatusChange={handleStatusChange}
        onShowDeletedChange={handleShowDeletedChange}
        isAdmin={isAdmin}
      />

      {/* Mobile: Card list */}
      <div className="space-y-2 sm:hidden">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const user = row.original;
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(user.id)}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm truncate ${user.deleted_at ? "text-muted-foreground line-through" : ""}`}>
                      {user.full_name || "לא צוין"}
                    </span>
                    <RoleBadge role={user.role} />
                  </div>
                  {user.phone && (
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {formatPhone(user.phone)}
                    </p>
                  )}
                </div>
                <StatusBadge isActive={user.is_active} />
              </div>
            );
          })
        ) : (
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            לא נמצאו משתמשים
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  לא נמצאו משתמשים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <UserTablePagination table={table} />
    </div>
  );
}
