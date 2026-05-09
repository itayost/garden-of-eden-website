"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
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
import { approveShiftChangeRequestAction } from "@/lib/actions/shift-change-requests";

interface ApproveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  summary: string;
  mergeNotice?: string | null;
  onSuccess?: () => void;
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  requestId,
  summary,
  mergeNotice,
  onSuccess,
}: ApproveRequestDialogProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await approveShiftChangeRequestAction(
        requestId,
        note.trim() || undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הבקשה אושרה ועודכנה במערכת");
      setNote("");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("שגיאה באישור הבקשה");
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
          <DialogTitle>אישור בקשה</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        {mergeNotice && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {mergeNotice}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="approve-note">הערה (לא חובה)</Label>
          <Textarea
            id="approve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="הערה למאמן (תוצג למאמן)"
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
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 me-2" />
            )}
            אשר
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
