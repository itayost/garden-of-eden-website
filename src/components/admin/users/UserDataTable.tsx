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
import { columns } from "./UserTableColumns";
import { UserTableToolbar } from "./UserTableToolbar";
import { UserTablePagination } from "./UserTablePagination";
import type { Profile } from "@/types/database";

interface UserDataTableProps {
  data: Profile[];
  initialSearch?: string;
  initialRole?: string | null;
  initialStatus?: string | null;
  initialShowDeleted?: boolean;
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
      />

      {/* Table */}
      <div className="rounded-md border">
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
