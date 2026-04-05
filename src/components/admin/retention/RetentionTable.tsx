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
import { RetentionNoteCell } from "./RetentionNoteCell";
import type { RetentionEntry } from "@/lib/arbox/retention";
import type { RetentionNote } from "@/lib/actions/admin-retention";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { Clock } from "lucide-react";

function getMonthName(monthKey: string): string {
  const [, monthStr] = monthKey.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return HEBREW_MONTHS[monthIndex] ?? monthKey;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

/** Get a stable key for notes lookup: phone or "no-phone:<name>" */
function getNoteKey(entry: RetentionEntry): string {
  return entry.phone ?? `no-phone:${entry.name.trim().toLowerCase()}`;
}

interface RetentionTableProps {
  entries: readonly RetentionEntry[];
  monthKeys: readonly string[];
  notes: ReadonlyMap<string, RetentionNote>;
  onSaveNote: (
    traineePhone: string,
    traineeName: string,
    note: string,
  ) => Promise<void>;
}

export function RetentionTable({
  entries,
  monthKeys,
  notes,
  onSaveNote,
}: RetentionTableProps) {
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
                {monthKeys.map((mk, i) => (
                  <TableHead key={mk} className="text-center">
                    <span className="inline-flex items-center gap-1">
                      {getMonthName(mk)}
                      {i === 0 && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => {
                const noteKey = getNoteKey(entry);
                const existingNote = notes.get(noteKey)?.note ?? "";

                return (
                  <TableRow key={`${entry.user_id ?? entry.name}-${i}`}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell>{formatDate(entry.end_date)}</TableCell>
                    {monthKeys.map((mk, mi) => (
                      <TableCell
                        key={mk}
                        className={`text-center ${mi === 0 ? "bg-muted/30" : ""}`}
                      >
                        {mi < entry.attendance.length &&
                        entry.attendance[mi] != null
                          ? entry.attendance[mi]
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell>
                      <RetentionNoteCell
                        note={existingNote}
                        onSave={(note) => onSaveNote(noteKey, entry.name, note)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
