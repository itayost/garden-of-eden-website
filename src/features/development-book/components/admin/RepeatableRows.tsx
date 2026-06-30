"use client";

import React from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-2">
      {columns.length > 0 && (
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

      {rows.map((row, index) => (
        <div
          key={(row as { id?: string }).id ?? index}
          className="grid gap-2 items-start"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, 1fr) auto`,
          }}
        >
          {columns.map((col) => {
            const value = row[col.key];
            const type = col.type ?? "text";

            if (col.render) {
              return (
                <div key={String(col.key)}>
                  {col.render(row, (v) => handleCellChange(index, col.key, v))}
                </div>
              );
            }

            if (type === "checkbox") {
              return (
                <div key={String(col.key)} className="flex items-center h-9">
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
                  key={String(col.key)}
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
                key={String(col.key)}
                value={String(value ?? "")}
                onChange={(e) =>
                  handleCellChange(index, col.key, e.target.value)
                }
                aria-label={col.labelHe}
              />
            );
          })}

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
        </div>
      ))}

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
