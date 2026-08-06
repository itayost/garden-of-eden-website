"use client";

import { useState } from "react";
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
import type { WorkoutProgram } from "@/features/workouts/lib/types";
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
 * point. Programs are copy sources, never assignments.
 */
export function CopyFromProgramDialog({
  open,
  onOpenChange,
  programs,
  onImport,
}: CopyFromProgramDialogProps) {
  const [programId, setProgramId] = useState<string>("");
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(false);

  const selectedProgram = programs.find((program) => program.id === programId);

  const handleImport = async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const grid = await getProgramForEdit(programId);
      if (!grid) {
        toast.error("שגיאה בטעינת התוכנית");
        return;
      }
      const rows = programWeekToBuilderRows(grid, week);
      if (rows.length === 0) {
        toast.error("אין תרגילים בתוכנית הזו");
        return;
      }
      onImport(rows);
      toast.success(`יובאו ${rows.length} תרגילים`);
      onOpenChange(false);
    } catch {
      toast.error("שגיאה בייבוא מהתוכנית");
    } finally {
      setLoading(false);
    }
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
            <Select
              value={programId}
              onValueChange={(value) => {
                setProgramId(value);
                setWeek(1);
              }}
            >
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button onClick={handleImport} disabled={loading || !programId}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              ייבוא
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
