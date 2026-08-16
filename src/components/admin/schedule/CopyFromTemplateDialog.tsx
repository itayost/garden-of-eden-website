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
import { getTemplateAction } from "@/lib/actions/session-templates";
import { templateToBuilderRows } from "@/lib/utils/session-import";
import type { SessionTemplateSummary } from "@/types/session-template";
import type { SessionBuilderRow } from "@/types/training-session";

interface CopyFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: SessionTemplateSummary[];
  onImport: (rows: SessionBuilderRow[]) => void;
}

/**
 * Loads a saved session template into the builder as a starting point.
 *
 * Same shape as CopyFromProgramDialog: the template loads on selection so the
 * trainer SEES the exercises that will land before confirming — no blind
 * imports. Unlike a program week, the rows come back with their numeric
 * targets and machine profiles intact.
 */
export function CopyFromTemplateDialog({
  open,
  onOpenChange,
  templates,
  onImport,
}: CopyFromTemplateDialogProps) {
  const [templateId, setTemplateId] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<SessionBuilderRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Guards against a slow earlier fetch landing after a fast later one and
  // overwriting the preview with the WRONG template's exercises.
  const requestedIdRef = useRef<string>("");

  const handleTemplateChange = async (value: string) => {
    setTemplateId(value);
    setPreviewRows([]);
    setLoading(true);
    requestedIdRef.current = value;
    try {
      const result = await getTemplateAction(value);
      // A newer selection superseded this request — drop the response.
      if (requestedIdRef.current !== value) return;
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (!result.data) {
        toast.error("התבנית לא נמצאה");
        return;
      }
      setPreviewRows(templateToBuilderRows(result.data));
    } catch {
      if (requestedIdRef.current === value) toast.error("שגיאה בטעינת התבנית");
    } finally {
      if (requestedIdRef.current === value) setLoading(false);
    }
  };

  const handleImport = () => {
    if (previewRows.length === 0) {
      toast.error("אין תרגילים בתבנית הזו");
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
          <DialogTitle>העתקה מתבנית</DialogTitle>
          <DialogDescription>
            תבנית אימון שמורה תיובא כנקודת התחלה, ואפשר לערוך ממנה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="copy-template">תבנית</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger id="copy-template">
                <SelectValue placeholder="בחירת תבנית" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.exerciseCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="max-h-52 space-y-0 overflow-y-auto rounded-md border">
              {previewRows.map((row, index) => {
                const targets = [
                  row.targetSets ? `${row.targetSets} סטים` : null,
                  row.targetRepsNum ? `${row.targetRepsNum} חזרות` : row.targetReps || null,
                  row.targetWeightKg ? `${row.targetWeightKg} ק"ג` : row.targetLoad || null,
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
              disabled={loading}
            >
              ביטול
            </Button>
            <Button onClick={handleImport} disabled={loading || previewRows.length === 0}>
              ייבוא {previewRows.length > 0 ? `(${previewRows.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
