"use client";

import { Table } from "@tanstack/react-table";
import { TablePagination } from "@/components/admin/TablePagination";
import type { WorkoutVideo } from "@/types/database";

interface VideoTablePaginationProps {
  table: Table<WorkoutVideo>;
}

/**
 * Pagination controls for the video data table.
 * Delegates to shared TablePagination with range display.
 */
export function VideoTablePagination({ table }: VideoTablePaginationProps) {
  return <TablePagination table={table} itemLabel="סרטונים" />;
}
