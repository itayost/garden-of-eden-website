"use client";

import React from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

export type ColumnDef<T> = {
  key: keyof T;
  labelHe: string;
  type?: "text" | "textarea" | "checkbox";
  render?: (row: T, onChange: (value: unknown) => void) => React.ReactNode;
};

type RepeatableRowsProps<T extends Record<string, unknown>> = {
  rows: T[];
  columns: ColumnDef<T>[];
  onChange: (rows: T[]) => void;
  newRow: () => T;
};

export function RepeatableRows<T extends Record<string, unknown>>({
  rows,
  columns,
  onChange,
  newRow,
}: RepeatableRowsProps<T>) {
  const isMobile = useIsMobile();

  function handleAdd() {
    onChange([...rows, newRow()]);
  }

  function handleDelete(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const next = [...rows];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function handleMoveDown(index: number) {
    if (index === rows.length - 1) return;
    const next = [...rows];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function handleCellChange(
    index: number,
    key: keyof T,
    value: unknown
  ) {
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      )
    );
  }

  function renderCell(col: ColumnDef<T>, row: T, index: number) {
    const value = row[col.key];
    const type = col.type ?? "text";

    if (col.render) {
      return col.render(row, (v) => handleCellChange(index, col.key, v));
    }

    if (type === "checkbox") {
      return (
        <div className="flex items-center h-9">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) =>
              handleCellChange(index, col.key, e.target.checked)
            }
            aria-label={col.labelHe}
            className="size-4 accent-primary cursor-pointer"
          />
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) =>
            handleCellChange(index, col.key, e.target.value)
          }
          aria-label={col.labelHe}
          rows={2}
        />
      );
    }

    return (
      <Input
        value={String(value ?? "")}
        onChange={(e) =>
          handleCellChange(index, col.key, e.target.value)
        }
        aria-label={col.labelHe}
      />
    );
  }

  const actionButtons = (index: number) => (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => handleMoveUp(index)}
        disabled={index === 0}
        aria-label="הזז למעלה"
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => handleMoveDown(index)}
        disabled={index === rows.length - 1}
        aria-label="הזז למטה"
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => handleDelete(index)}
        aria-label="מחק שורה"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop layout: grid with header row */}
      {!isMobile && columns.length > 0 && (
        <div
          className={cn(
            "grid gap-2 text-xs font-medium text-muted-foreground pb-1 border-b",
            "items-center"
          )}
          style={{
            gridTemplateColumns: `repeat(${columns.length}, 1fr) auto`,
          }}
        >
          {columns.map((col) => (
            <span key={String(col.key)}>{col.labelHe}</span>
          ))}
          <span className="sr-only">פעולות</span>
        </div>
      )}

      {rows.map((row, index) =>
        isMobile ? (
          /* Mobile layout: stacked card per row */
          <div
            key={(row as { id?: string }).id ?? index}
            className="border rounded-lg p-3 flex flex-col gap-3"
          >
            {columns.map((col) => (
              <div key={String(col.key)} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {col.labelHe}
                </span>
                {renderCell(col, row, index)}
              </div>
            ))}
            <div className="flex justify-end pt-1 border-t">
              {actionButtons(index)}
            </div>
          </div>
        ) : (
          /* Desktop layout: single grid row */
          <div
            key={(row as { id?: string }).id ?? index}
            className="grid gap-2 items-start"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, 1fr) auto`,
            }}
          >
            {columns.map((col) => (
              <div key={String(col.key)}>
                {renderCell(col, row, index)}
              </div>
            ))}
            {actionButtons(index)}
          </div>
        )
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="self-start mt-1"
      >
        הוסף שורה
      </Button>
    </div>
  );
}
