"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { RefundMethod } from "@/lib/validations/plans-admin";
import { previewVoidAction, voidPlanAction, type VoidPreview } from "../../lib/actions/void-plan";
import { AffectedBookings, CreditNoteStep, RefundMethodSelect } from "./RefundParts";

/**
 * Void: undo a Plan recorded by mistake, as if never sold. Shows first what
 * happens to the Trainee's Bookings, records how the money went back, then
 * points to the receipt in Morning so the credit note is issued there.
 */
export function VoidPlanDialog({ planId, onClose: close }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<VoidPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<RefundMethod>("none");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<{ refundId: string; receiptUrl: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  // The page refreshes only on close: refreshing earlier unmounts the
  // dialog before the credit note number is entered.
  const onClose = () => {
    if (done) router.refresh();
    close();
  };

  useEffect(() => {
    let cancelled = false;
    previewVoidAction(planId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setPreview(result);
      setMethod(result.suggestedMethod);
      setAmount(result.amountPaid ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const confirm = () =>
    startTransition(async () => {
      const result = await voidPlanAction({ planId, reason, method, reference, amountIls: amount });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cancelledCount > 0 ? `הרישום בוטל. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.` : "הרישום בוטל",
      );
      setDone({ refundId: result.refundId, receiptUrl: result.receiptUrl });
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ביטול רישום{preview ? `: ${preview.planName}` : ""}</DialogTitle>
          <DialogDescription>מסלול שנרשם בטעות מתבטל כאילו לא נמכר, וכל הסכום חוזר.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !preview ? (
          <Skeleton className="h-32 w-full" />
        ) : done ? (
          <CreditNoteStep refundId={done.refundId} receiptUrl={done.receiptUrl} onDone={onClose} />
        ) : preview.refusal ? (
          <p className="text-sm text-destructive">{preview.refusal}</p>
        ) : (
          <div className="space-y-4">
            <AffectedBookings moved={preview.moved} cancelled={preview.cancelled} />

            <div className="space-y-1">
              <Label htmlFor="void-reason">סיבה</Label>
              <Textarea
                id="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="למשל: נרשם מסלול לא נכון"
                maxLength={300}
                disabled={pending}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-method">איך הכסף הוחזר</Label>
              <RefundMethodSelect value={method} onChange={setMethod} disabled={pending} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="void-amount">סכום שהוחזר (₪)</Label>
                <Input
                  id="void-amount"
                  type="number"
                  min={0}
                  max={preview.amountPaid ?? undefined}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="void-ref">אסמכתא (לא חובה)</Label>
                <Input id="void-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} disabled={pending} />
              </div>
            </div>

            <Button variant="destructive" className="w-full" onClick={confirm} disabled={pending || reason.trim().length < 2}>
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              ביטול הרישום
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
