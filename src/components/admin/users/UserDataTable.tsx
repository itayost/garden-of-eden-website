"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type RowSelectionState,
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
import { getUserColumns } from "./UserTableColumns";
import { BulkBranchAssignBar } from "./BulkBranchAssignBar";
import { UserTableToolbar } from "./UserTableToolbar";
import { matchesPositionFilter } from "@/lib/admin/position-filter";
import { UserTablePagination } from "./UserTablePagination";
import { Badge } from "@/components/ui/badge";
import { matchesBranchFilter } from "@/lib/admin/branch-filter";
import { formatPhoneToLocal } from "@/lib/validations/common";
import type { ProfileWithBranches, BranchOption } from "@/types/branches";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

interface UserDataTableProps {
  data: ProfileWithBranches[];
  branches: BranchOption[];
  initialSearch?: string;
  initialRole?: string | null;
  initialStatus?: string | null;
  initialPosition?: string | null;
  initialBranch?: string | null;
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
  branches,
  initialSearch = "",
  initialRole = null,
  initialStatus = null,
  initialPosition = null,
  initialBranch = null,
  initialShowDeleted = false,
  isAdmin = true,
}: UserDataTableProps) {
  const router = useRouter();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const columns = useMemo(() => getUserColumns({ selectable: isAdmin }), [isAdmin]);

  // Filter state (controlled by toolbar, synced with URL)
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<string | null>(initialRole);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialStatus);
  const [positionFilter, setPositionFilter] = useState<string | null>(initialPosition);
  const [branchFilter, setBranchFilter] = useState<string | null>(initialBranch);
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
        const matchesPhone = formatPhoneToLocal(user.phone).includes(
          formatPhoneToLocal(globalFilter),
        );
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

      if (!matchesPositionFilter(user.position, positionFilter)) return false;
      if (!matchesBranchFilter(user.branchIds, branchFilter)) return false;

      return true;
    });
  }, [data, globalFilter, roleFilter, statusFilter, positionFilter, branchFilter, showDeleted]);

  // Initialize TanStack Table
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: isAdmin,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // A row ticked before a filter change may no longer be on screen; the bulk
  // action only touches users the admin can currently see.
  const selectedUserIds = useMemo(() => {
    const visible = new Set(filteredData.map((user) => user.id));
    return Object.keys(rowSelection).filter((id) => rowSelection[id] && visible.has(id));
  }, [rowSelection, filteredData]);

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

  const handlePositionChange = useCallback((value: string | null) => {
    setPositionFilter(value);
  }, []);

  const handleBranchChange = useCallback((value: string | null) => {
    setBranchFilter(value);
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
        onPositionChange={handlePositionChange}
        onBranchChange={handleBranchChange}
        branchOptions={branches}
        onShowDeletedChange={handleShowDeletedChange}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <BulkBranchAssignBar
          selectedUserIds={selectedUserIds}
          branches={branches}
          onDone={() => setRowSelection({})}
        />
      )}

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
                    {user.branchNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px]">
                        {name}
                      </Badge>
                    ))}
                  </div>
                  {user.phone && (
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {formatPhoneToLocal(user.phone)}
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
