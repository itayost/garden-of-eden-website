"use client";

import Papa from "papaparse";
import { toast } from "sonner";

/**
 * Hook for exporting data to CSV with Hebrew Excel support.
 *
 * Handles:
 * - UTF-8 BOM for Hebrew characters in Excel
 * - Blob creation and download link lifecycle
 * - Success toast notification
 */
export function useCSVExport() {
  const exportToCSV = (
    data: Record<string, string | number>[],
    filename: string,
    successMessage?: string
  ) => {
    if (data.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);

    if (successMessage) {
      toast.success(successMessage);
    }
  };

  return { exportToCSV };
}

/**
 * Format date for display in CSV (DD/MM/YYYY)
 */
export function formatDateHebrew(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
export function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
