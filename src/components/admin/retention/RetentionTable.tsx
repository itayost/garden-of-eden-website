"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableToolbar } from "@/components/admin/TableToolbar";
import type { RetentionEntry } from "@/lib/arbox/retention";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

function getMonthName(monthKey: string): string {
  const [, monthStr] = monthKey.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return HEBREW_MONTHS[monthIndex] ?? monthKey;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

interface RetentionTableProps {
  entries: readonly RetentionEntry[];
  monthKeys: readonly string[];
}

export function RetentionTable({ entries, monthKeys }: RetentionTableProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? entries.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="חיפוש לפי שם..."
      />

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          אין נתונים לחודש זה
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם לקוח</TableHead>
                <TableHead className="text-right">תאריך סיום</TableHead>
                {monthKeys.map((mk) => (
                  <TableHead key={mk} className="text-center">
                    {getMonthName(mk)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => (
                <TableRow key={`${entry.user_id ?? entry.name}-${i}`}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell>{formatDate(entry.end_date)}</TableCell>
                  {entry.attendance.map((count, mi) => (
                    <TableCell key={monthKeys[mi]} className="text-center">
                      {count != null ? count : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
