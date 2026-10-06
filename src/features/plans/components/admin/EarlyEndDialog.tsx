"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { earlyEndPlanAction, previewEarlyEndAction, type EarlyEndPreview } from "../../lib/actions/early-end";
import { AffectedBookings } from "./RefundParts";
import { usePlanPreview } from "../../hooks/usePlanPreview";

/**
 * Early end: the Current plan ends today so the Plan queued behind it starts
 * today. What is left on it is forfeited and no money moves.
 */
export function EarlyEndDialog({ planId, onClose }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const { preview, loadError } = usePlanPreview<EarlyEndPreview>(planId, () => previewEarlyEndAction(planId));

  const confirm = () =>
    startTransition(async () => {
      const result = await earlyEndPlanAction({ planId, reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cancelledCount > 0 ? `המסלול הסתיים. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.` : "המסלול הסתיים",
      );
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>סיום מוקדם{preview ? `: ${preview.planName}` : ""}</DialogTitle>
          <DialogDescription>המסלול מסתיים היום והמסלול הבא בתור מתחיל היום. מה שנשאר בו לא מוחזר, ואין שינוי בתשלום.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !preview ? (
          <Skeleton className="h-28 w-full" />
        ) : preview.refusal ? (
          <p className="text-sm text-destructive">{preview.refusal}</p>
        ) : (
          <div className="space-y-4">
            {preview.nextPlanName && (
              <p className="text-sm">
                מתחיל היום: <span className="font-bold">{preview.nextPlanName}</span>
              </p>
            )}
            <AffectedBookings moved={preview.moved} cancelled={preview.cancelled} />
            <div className="space-y-1">
              <Label htmlFor="early-end-reason">סיבה</Label>
              <Textarea
                id="early-end-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="למשל: עבר למסלול מתקדמים"
                maxLength={300}
                disabled={pending}
              />
            </div>
            <Button className="w-full" onClick={confirm} disabled={pending || reason.trim().length < 2}>
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              סיום המסלול היום
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
