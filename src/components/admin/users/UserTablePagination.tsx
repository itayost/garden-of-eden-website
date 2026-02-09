"use client";

import { Table } from "@tanstack/react-table";
import { TablePagination } from "@/components/admin/TablePagination";

interface UserTablePaginationProps<TData> {
  table: Table<TData>;
}

/**
 * Pagination controls for the user data table.
 * Delegates to shared TablePagination with page size selector enabled.
 */
export function UserTablePagination<TData>({
  table,
}: UserTablePaginationProps<TData>) {
  return <TablePagination table={table} showPageSize />;
}
