"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTemplateAction } from "@/lib/actions/session-templates";
import { rowsToExerciseInput } from "@/lib/utils/session-import";
import type { SessionBuilderRow } from "@/types/training-session";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: SessionBuilderRow[];
  /** Prefills the name, so the common case is one confirm. */
  defaultName: string;
}

/**
 * Saves the session the trainer just composed as a named, reusable template.
 *
 * It saves the CURRENT rows, edits included — not what was last persisted to
 * the session — so the preview list below the name is the contract: this is
 * exactly what will be stored.
 */
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  rows,
  defaultName,
}: SaveAsTemplateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("יש להזין שם לתבנית");
      return;
    }
    setSaving(true);
    try {
      const result = await createTemplateAction({
        name,
        description,
        exercises: rowsToExerciseInput(rows),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("התבנית נשמרה");
      onOpenChange(false);
      setDescription("");
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת התבנית");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>שמירה כתבנית</DialogTitle>
          <DialogDescription>
            האימון יישמר כתבנית שאפשר לטעון לכל מתאמן אחר. שמירת התבנית אינה
            שומרת את האימון עצמו.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">שם התבנית</Label>
            <Input
              id="template-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="למשל: פלג גוף עליון א"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">תיאור (לא חובה)</Label>
            <Textarea
              id="template-description"
              value={description}
              maxLength={300}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="למי התבנית מתאימה, מתי להשתמש בה"
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {rows.length} תרגילים יישמרו בתבנית
            </p>
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="truncate border-b px-3 py-1.5 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {row.exerciseName}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving || rows.length === 0}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
