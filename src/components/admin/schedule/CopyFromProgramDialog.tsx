"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProgramForEdit } from "@/features/workouts/lib/actions";
import type { ProgramGrid, WorkoutProgram } from "@/features/workouts/lib/types";
import { programWeekToBuilderRows } from "@/lib/utils/session-import";
import type { SessionBuilderRow } from "@/types/training-session";

interface CopyFromProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: WorkoutProgram[];
  onImport: (rows: SessionBuilderRow[]) => void;
}

/**
 * Pulls one week column of a workout program into the builder as a starting
 * point. The grid loads on program selection so the trainer SEES the
 * exercises that will land before confirming — no blind imports.
 */
export function CopyFromProgramDialog({
  open,
  onOpenChange,
  programs,
  onImport,
}: CopyFromProgramDialogProps) {
  const [programId, setProgramId] = useState<string>("");
  const [week, setWeek] = useState(1);
  const [grid, setGrid] = useState<ProgramGrid | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  // Guards against a slow earlier fetch landing after a fast later one and
  // overwriting the preview with the WRONG program's exercises.
  const requestedIdRef = useRef<string>("");

  const selectedProgram = programs.find((program) => program.id === programId);
  const previewRows = grid ? programWeekToBuilderRows(grid, week) : [];

  const handleProgramChange = async (value: string) => {
    setProgramId(value);
    setWeek(1);
    setGrid(null);
    setLoadingGrid(true);
    requestedIdRef.current = value;
    try {
      const loaded = await getProgramForEdit(value);
      // A newer selection superseded this request — drop the response.
      if (requestedIdRef.current !== value) return;
      if (!loaded) {
        toast.error("שגיאה בטעינת התוכנית");
        return;
      }
      setGrid(loaded);
    } catch {
      if (requestedIdRef.current === value) toast.error("שגיאה בטעינת התוכנית");
    } finally {
      if (requestedIdRef.current === value) setLoadingGrid(false);
    }
  };

  const handleImport = () => {
    if (previewRows.length === 0) {
      toast.error("אין תרגילים בתוכנית הזו");
      return;
    }
    onImport(previewRows);
    toast.success(`יובאו ${previewRows.length} תרגילים`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>העתקה מתוכנית</DialogTitle>
          <DialogDescription>
            שבוע אחד מתוך תוכנית קיימת ייובא כנקודת התחלה, ואפשר לערוך ממנו.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="copy-program">תוכנית</Label>
            <Select value={programId} onValueChange={handleProgramChange}>
              <SelectTrigger id="copy-program">
                <SelectValue placeholder="בחירת תוכנית" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProgram && selectedProgram.weeks > 1 && (
            <div className="space-y-2">
              <Label htmlFor="copy-week">שבוע</Label>
              <Select
                value={String(week)}
                onValueChange={(value) => setWeek(Number(value))}
              >
                <SelectTrigger id="copy-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: selectedProgram.weeks }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      שבוע {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {loadingGrid && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="max-h-52 space-y-0 overflow-y-auto rounded-md border">
              {previewRows.map((row, index) => {
                const targets = [
                  row.targetSets ? `${row.targetSets} סטים` : null,
                  row.targetReps || null,
                  row.targetLoad || null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{index + 1}. </span>
                      {row.exerciseName}
                    </span>
                    {targets && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {targets}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loadingGrid}
            >
              ביטול
            </Button>
            <Button
              onClick={handleImport}
              disabled={loadingGrid || previewRows.length === 0}
            >
              ייבוא {previewRows.length > 0 ? `(${previewRows.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
