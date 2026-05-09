"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rejectShiftChangeRequestAction } from "@/lib/actions/shift-change-requests";

interface RejectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  summary: string;
  onSuccess?: () => void;
}

export function RejectRequestDialog({
  open,
  onOpenChange,
  requestId,
  summary,
  onSuccess,
}: RejectRequestDialogProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await rejectShiftChangeRequestAction(
        requestId,
        note.trim() || undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הבקשה נדחתה");
      setNote("");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("שגיאה בדחיית הבקשה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setNote("");
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>דחיית בקשה</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-note">הערה (לא חובה)</Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="סיבת הדחייה (תוצג למאמן)"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ביטול
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <X className="h-4 w-4 me-2" />
            )}
            דחה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
