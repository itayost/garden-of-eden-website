"use client";

import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { createExceptionAction, updateExceptionAction } from "@/lib/actions/weekly-schedule";

interface ExceptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: TrainerOption[];
  /**
   * Seeds the date field. The week view opens this from a dated column, where
   * retyping the date the user just clicked would be absurd.
   */
  defaultDate?: string;
  /**
   * Only admins may write exceptions. The gate is repeated here rather than
   * left to each caller hiding its trigger: two callers now, and a hidden
   * trigger is not a permission.
   */
  canEdit: boolean;
  /** An absence to correct; without it the dialog records a new one. */
  exception?: { id: string; exceptionDate: string; trainerId: string; note: string | null };
}

/**
 * Records a trainer absent for one date. It never edits a Band, so next week
 * is untouched. A one-off extra hour is not an exception: it is a slot made
 * with "+ סלוט", where it can take trainees and bookings.
 *
 * Records a new absence, or corrects one when `exception` is passed (from the
 * calendar's pencil next to the absence).
 */
export function ExceptionFormDialog({
  open,
  onOpenChange,
  trainers,
  defaultDate,
  canEdit,
  exception,
}: ExceptionFormDialogProps) {
  const { branchId } = useCurrentBranch();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Seeded once per mount; callers pass key={exception.id} to edit another.
  const [exceptionDate, setExceptionDate] = useState(exception?.exceptionDate ?? defaultDate ?? "");
  const [trainerId, setTrainerId] = useState(exception?.trainerId ?? "");
  const [note, setNote] = useState(exception?.note ?? "");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trainerId) {
      toast.error("יש לבחור מאמן");
      return;
    }

    setLoading(true);
    try {
      const fields = { branchId, exceptionDate, trainerId, kind: "absent" as const, note };
      const result = exception
        ? await updateExceptionAction({ ...fields, exceptionId: exception.id })
        : await createExceptionAction(fields);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(exception ? "ההיעדרות עודכנה" : "ההיעדרות נשמרה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת החריגה");
    } finally {
      setLoading(false);
    }
  };

  // Writing an exception is admin-only; a hidden trigger is not a gate.
  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle>{exception ? "עריכת היעדרות" : "היעדרות מאמן"}</DialogTitle>
          <DialogDescription>
            המאמן יורד מהשעות שלו ביום הזה. שעה נוספת נוצרת ביומן דרך &quot;+ סלוט&quot;.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="space-y-2">
            <Label htmlFor="exception-date">תאריך</Label>
            <Input
              id="exception-date"
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-trainer">מאמן</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger id="exception-trainer">
                <SelectValue placeholder="בחירת מאמן" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.full_name ?? "ללא שם"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-note">הערה (אופציונלי)</Label>
            <Input
              id="exception-note"
              value={note}
              placeholder="לדוגמה: חופשה"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background px-4 pt-3 pb-1 sm:-mx-6 sm:px-6">
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
              שמירה
            </Button>
          </div>
        </form>
      </SheetDialogContent>
    </Dialog>
  );
}
