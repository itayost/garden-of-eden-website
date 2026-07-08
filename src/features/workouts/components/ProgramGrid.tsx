"use client";

import { ChevronUp, ChevronDown, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GridCell } from "@/features/workouts/components/GridCell";
import { copyCellAcrossWeeks } from "@/features/workouts/lib/grid-utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ProgramExerciseRow, ProgramCell } from "@/features/workouts/lib/types";

interface ProgramGridProps {
  rows: ProgramExerciseRow[];
  weeks: number;
  onRowsChange: (rows: ProgramExerciseRow[]) => void;
}

export function ProgramGrid({ rows, weeks, onRowsChange }: ProgramGridProps) {
  const isMobile = useIsMobile();
  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1);

  const updateRow = (rowKey: string, patch: Partial<ProgramExerciseRow>) => {
    onRowsChange(
      rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r))
    );
  };

  const updateCell = (rowKey: string, weekIndex: number, updated: ProgramCell) => {
    onRowsChange(
      rows.map((r) => {
        if (r.key !== rowKey) return r;
        const newCells = r.cells.map((c, idx) => (idx === weekIndex ? updated : c));
        return { ...r, cells: newCells };
      })
    );
  };

  const moveRow = (rowKey: string, direction: -1 | 1) => {
    const idx = rows.findIndex((r) => r.key === rowKey);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= rows.length) return;
    onRowsChange(
      rows.map((r, i) => (i === idx ? rows[newIdx] : i === newIdx ? rows[idx] : r))
    );
  };

  const removeRow = (rowKey: string) => {
    onRowsChange(rows.filter((r) => r.key !== rowKey));
  };

  const copyWeekOne = (rowKey: string) => {
    onRowsChange(
      rows.map((r) => {
        if (r.key !== rowKey) return r;
        return { ...r, cells: copyCellAcrossWeeks(r.cells, 0) };
      })
    );
  };

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
        אין תרגילים בתוכנית. לחץ &quot;הוסף תרגיל&quot; כדי להתחיל.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        {rows.map((row, rowIdx) => (
          <div key={row.key} className="border rounded-lg p-3 bg-background">
            {/* Card header: exercise name + row actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1.5">
                <p className="font-medium text-sm leading-tight">
                  {row.exerciseName}
                </p>
                <Input
                  placeholder="הערות תרגיל"
                  aria-label="הערות תרגיל"
                  value={row.notesHe}
                  onChange={(e) =>
                    updateRow(row.key, { notesHe: e.target.value })
                  }
                  className="h-8 text-xs px-2"
                />
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveRow(row.key, -1)}
                  disabled={rowIdx === 0}
                  aria-label="הזז למעלה"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveRow(row.key, 1)}
                  disabled={rowIdx === rows.length - 1}
                  aria-label="הזז למטה"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyWeekOne(row.key)}
                  title="העתק שבוע 1 לכולם"
                  aria-label="העתק שבוע 1 לכולם"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeRow(row.key)}
                  aria-label="הסר תרגיל"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Weeks list */}
            <div className="mt-3 flex flex-col gap-2">
              {weekNumbers.map((w, weekIdx) => {
                const cell = row.cells[weekIdx];
                if (!cell) return null;
                return (
                  <div
                    key={w}
                    className="rounded-md border border-dashed p-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                      שבוע {w}
                    </p>
                    <GridCell
                      cell={cell}
                      onChange={(updated) => updateCell(row.key, weekIdx, updated)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th
              className="border-e bg-muted/80 p-2 text-start font-semibold whitespace-nowrap z-10"
              style={{ position: "sticky", insetInlineStart: 0 }}
            >
              תרגיל
            </th>
            {weekNumbers.map((w) => (
              <th
                key={w}
                className="border-e p-2 text-center font-medium whitespace-nowrap min-w-[120px]"
              >
                שבוע {w}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={row.key} className="align-top border-t hover:bg-muted/20">
              {/* Sticky exercise column */}
              <td
                className="border-e bg-background p-2 min-w-[180px] max-w-[220px] z-10"
                style={{ position: "sticky", insetInlineStart: 0 }}
              >
                <div className="space-y-1.5">
                  <p className="font-medium text-sm leading-tight">
                    {row.exerciseName}
                  </p>

                  {/* Row notes */}
                  <Input
                    placeholder="הערות תרגיל"
                    aria-label="הערות תרגיל"
                    value={row.notesHe}
                    onChange={(e) =>
                      updateRow(row.key, { notesHe: e.target.value })
                    }
                    className="h-7 text-xs px-1"
                  />

                  {/* Reorder + remove controls */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveRow(row.key, -1)}
                      disabled={rowIdx === 0}
                      aria-label="הזז למעלה"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveRow(row.key, 1)}
                      disabled={rowIdx === rows.length - 1}
                      aria-label="הזז למטה"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyWeekOne(row.key)}
                      title="העתק שבוע 1 לכולם"
                      aria-label="העתק שבוע 1 לכולם"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeRow(row.key)}
                      aria-label="הסר תרגיל"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </td>

              {/* Week cells */}
              {weekNumbers.map((_, weekIdx) => {
                const cell = row.cells[weekIdx];
                if (!cell) return <td key={weekIdx} className="border-e p-2" />;
                return (
                  <td key={weekIdx} className="border-e p-2">
                    <GridCell
                      cell={cell}
                      onChange={(updated) => updateCell(row.key, weekIdx, updated)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
