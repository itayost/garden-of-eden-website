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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeTaskAction, reopenTaskAction } from "@/lib/actions/admin-tasks";

type NoteMode = "complete" | "reopen";

interface TaskNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  mode: NoteMode;
}

const COPY: Record<
  NoteMode,
  {
    title: string;
    description: string;
    label: string;
    placeholder: string;
    submit: string;
    success: string;
    failure: string;
  }
> = {
  complete: {
    title: "סגירת משימה",
    description: "אפשר להוסיף מה נעשה בפועל. המנהל יראה את ההערה בבדיקה.",
    label: "הערת סגירה (אופציונלי)",
    placeholder: "לדוגמה: תיקנתי את הרשת והחלפתי שתי חבקים.",
    submit: "סגירת המשימה",
    success: "המשימה נסגרה",
    failure: "שגיאה בסגירת המשימה",
  },
  reopen: {
    title: "פתיחת משימה מחדש",
    description: "המשימה תחזור להיות פתוחה אצל המאמן. כדאי להסביר למה.",
    label: "סיבת הפתיחה מחדש (אופציונלי)",
    placeholder: "לדוגמה: הרשת עדיין קרועה בפינה הימנית.",
    submit: "פתיחה מחדש",
    success: "המשימה נפתחה מחדש",
    failure: "שגיאה בפתיחת המשימה מחדש",
  },
};

/**
 * Shared dialog for the two status transitions that carry optional free text.
 * Both are a single textarea plus a confirm, so they share one component and
 * differ only in copy and the action they call.
 */
export function TaskNoteDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  mode,
}: TaskNoteDialogProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result =
        mode === "complete"
          ? await completeTaskAction({ taskId, completionNote: note })
          : await reopenTaskAction({ taskId, reopenReason: note });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(copy.success);
      setNote("");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(copy.failure);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
            {taskTitle}
          </p>

          <div className="space-y-2">
            <Label htmlFor="task-note">{copy.label}</Label>
            <Textarea
              id="task-note"
              rows={4}
              value={note}
              placeholder={copy.placeholder}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {copy.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
