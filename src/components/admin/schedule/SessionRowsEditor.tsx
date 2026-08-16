"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_WEIGHT_STEP_KG,
  resolveTrackingProfile,
  type TrackingProfile,
} from "@/lib/utils/performance-profile";
import { MEASURE_BOUNDS } from "@/lib/validations/measures";
import type { SessionBuilderRow } from "@/types/training-session";

/**
 * The ordered, editable list of prescribed exercises.
 *
 * Shared by the daily-board session builder and the session-template editor —
 * a template is the same list of rows with the same targets, so the two must
 * not drift apart. The component owns no state: the parent holds the rows and
 * decides what saving them means.
 */

/**
 * The numeric target inputs a row can show, in render order.
 *
 * One entry per measure, matching the log dialog: a treadmill tracks time AND
 * distance and must be able to receive a target for both. A row with no
 * machine shows the free-text load field instead of any of these.
 */
const NUMERIC_TARGETS = [
  {
    flag: "tracksWeight",
    field: "targetWeightKg",
    label: 'משקל (ק"ג)',
    min: 0,
    max: MEASURE_BOUNDS.weightKg.max,
    mode: "decimal",
  },
  {
    flag: "tracksDuration",
    field: "targetDurationSeconds",
    label: "זמן (שניות)",
    min: MEASURE_BOUNDS.durationSeconds.min,
    max: MEASURE_BOUNDS.durationSeconds.max,
    mode: "numeric",
  },
  {
    flag: "tracksDistance",
    field: "targetDistanceM",
    label: "מרחק (מטרים)",
    min: MEASURE_BOUNDS.distanceM.min,
    max: MEASURE_BOUNDS.distanceM.max,
    mode: "numeric",
  },
] as const satisfies readonly {
  flag: keyof TrackingProfile;
  field: keyof SessionBuilderRow;
  label: string;
  min: number;
  max: number;
  mode: "numeric" | "decimal";
}[];

/** The numeric target inputs this row should render. */
function rowTargets(row: SessionBuilderRow) {
  if (!row.equipment) return [];
  const profile = resolveTrackingProfile(row.equipment);
  return NUMERIC_TARGETS.filter((target) => profile[target.flag]);
}

interface SessionRowsEditorProps {
  rows: SessionBuilderRow[];
  onRowsChange: (next: SessionBuilderRow[]) => void;
  /** What to say when there are no rows yet. */
  emptyMessage: string;
  /** Session builder only — "בוצע בפועל" lines, keyed by row key. */
  logByRowKey?: Record<string, string>;
}

export function SessionRowsEditor({
  rows,
  onRowsChange,
  emptyMessage,
  logByRowKey,
}: SessionRowsEditorProps) {
  /**
   * Any edit clears the "seeded from the machine" badge — otherwise it keeps
   * claiming the numbers are defaults after the trainer has changed them.
   */
  const updateRow = (key: string, patch: Partial<SessionBuilderRow>) => {
    onRowsChange(
      rows.map((row) =>
        row.key === key ? { ...row, ...patch, seededFromEquipment: false } : row,
      ),
    );
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onRowsChange(next);
  };

  const removeRow = (key: string) => {
    onRowsChange(rows.filter((row) => row.key !== key));
  };

  if (rows.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="rounded-full bg-muted p-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl py-0">
      <CardContent className="divide-y px-4 py-1">
        {rows.map((row, index) => {
          const loggedLine = logByRowKey?.[row.key];
          return (
            <div key={row.key} className="group flex items-start gap-3 py-3">
              <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-extrabold text-cream">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{row.exerciseName}</p>
                  <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      aria-label="הזזה למעלה"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label="הזזה למטה"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeRow(row.key)}
                      aria-label={`הסרת ${row.exerciseName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {row.seededFromEquipment && (
                  <p className="text-[11px] font-medium text-amber-700">
                    ברירת מחדל מהציוד
                    {row.equipment ? ` · ${row.equipment.name_he}` : ""}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Input
                    id={`sets-${row.key}`}
                    type="number"
                    min={1}
                    max={MEASURE_BOUNDS.sets.max}
                    inputMode="numeric"
                    placeholder="סטים"
                    aria-label="סטים"
                    className="h-9"
                    value={row.targetSets ?? ""}
                    onChange={(event) =>
                      updateRow(row.key, {
                        targetSets:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                  {/* A machine that counts reps gets a number; anything
                      else keeps the free text, where "8-10" and "עד כשל"
                      live. Both columns exist, so nothing is lost. */}
                  {row.equipment?.tracks_reps ? (
                    <Input
                      id={`reps-${row.key}`}
                      type="number"
                      min={MEASURE_BOUNDS.reps.min}
                      max={MEASURE_BOUNDS.reps.max}
                      inputMode="numeric"
                      placeholder="חזרות"
                      aria-label="חזרות"
                      className="h-9"
                      value={row.targetRepsNum}
                      onChange={(event) =>
                        updateRow(row.key, { targetRepsNum: event.target.value })
                      }
                    />
                  ) : (
                    <Input
                      id={`reps-${row.key}`}
                      placeholder="חזרות (8-10)"
                      aria-label="חזרות"
                      className="h-9"
                      value={row.targetReps}
                      onChange={(event) =>
                        updateRow(row.key, { targetReps: event.target.value })
                      }
                    />
                  )}
                  {/* One input per measure the machine records. A
                      treadmill tracks time AND distance, so these are
                      independent, not a choice of one. */}
                  {rowTargets(row).map((target) => (
                    <Input
                      key={target.field}
                      id={`${target.field}-${row.key}`}
                      type="number"
                      min={target.min}
                      max={target.max}
                      step={
                        target.field === "targetWeightKg"
                          ? (row.equipment?.weight_step_kg ?? DEFAULT_WEIGHT_STEP_KG)
                          : 1
                      }
                      inputMode={target.mode}
                      placeholder={target.label}
                      aria-label={target.label}
                      className="h-9"
                      value={row[target.field]}
                      onChange={(event) =>
                        updateRow(row.key, { [target.field]: event.target.value })
                      }
                    />
                  ))}

                  {/* No machine: keep the free-text load field exactly as
                      it was before profiles existed. */}
                  {!row.equipment && (
                    <Input
                      id={`load-${row.key}`}
                      placeholder={'משקל (20 ק"ג)'}
                      aria-label="משקל או עומס"
                      className="h-9"
                      value={row.targetLoad}
                      onChange={(event) =>
                        updateRow(row.key, { targetLoad: event.target.value })
                      }
                    />
                  )}

                  <Input
                    id={`notes-${row.key}`}
                    placeholder="הערה"
                    aria-label="הערה"
                    className="h-9"
                    value={row.notes}
                    onChange={(event) =>
                      updateRow(row.key, { notes: event.target.value })
                    }
                  />
                </div>

                {loggedLine && (
                  <p className="text-xs font-medium text-green-700 tabular-nums">
                    בוצע בפועל: {loggedLine}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
