"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { csvDownloadText } from "../../lib/csv";

interface SurveyCsvButtonProps {
  /** One row per Response, from surveyCsvRows(): every cell is already safe to open in Excel. */
  rows: Record<string, string>[];
  fileName: string;
  className?: string;
}

/** Downloads every Response in view as a CSV file with a byte order mark for Hebrew in Excel. */
export function SurveyCsvButton({ rows, fileName, className }: SurveyCsvButtonProps) {
  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }
    const blob = new Blob([csvDownloadText(rows)], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(rows.length === 1 ? "יוצאה תשובה אחת" : `יוצאו ${rows.length} תשובות`);
  };

  return (
    <Button type="button" variant="outline" className={className} onClick={handleExport} disabled={rows.length === 0}>
      <Download aria-hidden="true" />
      CSV
    </Button>
  );
}
