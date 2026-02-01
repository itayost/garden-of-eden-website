"use client";

import { useState, useMemo, useCallback } from "react";
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
import { columns } from "./VideoTableColumns";
import { VideoTableToolbar } from "./VideoTableToolbar";
import { VideoTablePagination } from "./VideoTablePagination";
import type { WorkoutVideo } from "@/types/database";

interface VideoDataTableProps {
  data: WorkoutVideo[];
  renderActions?: (video: WorkoutVideo) => React.ReactNode;
}

/**
 * Main data table component for admin video list
 * Integrates TanStack Table with toolbar filters and pagination
 * Videos don't have a detail page, so no row click navigation
 */
export function VideoDataTable({ data, renderActions }: VideoDataTableProps) {
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Filter state
  const [globalFilter, setGlobalFilter] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  // Memoized filtered data based on all criteria
  const filteredData = useMemo(() => {
    return data.filter((video) => {
      // Global search (matches title, case-insensitive)
      if (globalFilter) {
        const searchLower = globalFilter.toLowerCase();
        const matchesTitle = video.title.toLowerCase().includes(searchLower);
        if (!matchesTitle) return false;
      }

      // Day filter (exact match)
      if (dayFilter !== null && video.day_number !== dayFilter) {
        return false;
      }

      return true;
    });
  }, [data, globalFilter, dayFilter]);

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

  // Toolbar callbacks (memoized to prevent unnecessary rerenders)
  const handleSearchChange = useCallback((value: string) => {
    setGlobalFilter(value);
  }, []);

  const handleDayFilterChange = useCallback((value: number | null) => {
    setDayFilter(value);
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <VideoTableToolbar
        onSearchChange={handleSearchChange}
        onDayFilterChange={handleDayFilterChange}
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
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.column.id === "actions" && renderActions
                        ? renderActions(row.original)
                        : flexRender(
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
                  לא נמצאו סרטונים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <VideoTablePagination table={table} />
    </div>
  );
}
