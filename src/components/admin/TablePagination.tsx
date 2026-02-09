"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface TablePaginationProps<TData> {
  table: Table<TData>;
  /** Show page size selector. Defaults to false (shows range display instead). */
  showPageSize?: boolean;
  /** Page size options. Defaults to [10, 20, 50]. */
  pageSizeOptions?: number[];
  /** Label for the items being paginated (e.g. "סרטונים"). Used in range display. */
  itemLabel?: string;
}

/**
 * Shared pagination controls for data tables.
 * RTL layout: Previous is on the right (chevron-right), Next is on the left (chevron-left).
 */
export function TablePagination<TData>({
  table,
  showPageSize = false,
  pageSizeOptions = [10, 20, 50],
  itemLabel,
}: TablePaginationProps<TData>) {
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;

  // Calculate display range
  const start = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      {/* Left side: Page size or range display */}
      {showPageSize ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">שורות בעמוד</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">
          מציג {start}-{end} מתוך {totalRows}
          {itemLabel ? ` ${itemLabel}` : ""}
        </span>
      )}

      {/* Right side: Page info and navigation */}
      <div className="flex items-center gap-2">
        {showPageSize && (
          <span className="text-sm text-muted-foreground">
            עמוד {currentPage} מתוך {pageCount || 1}
          </span>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="עמוד קודם"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="עמוד הבא"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
