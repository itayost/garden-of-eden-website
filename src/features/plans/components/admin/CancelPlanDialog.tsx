"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { RefundMethod } from "@/lib/validations/plans-admin";
import {
  cancelPlanWithRefundAction,
  previewCancellationAction,
  type CancellationPreview,
} from "../../lib/actions/cancel-plan";
import { AffectedBookings, CreditNoteStep, RefundMethodSelect } from "./RefundParts";
import { usePlanPreview } from "../../hooks/usePlanPreview";

const shekels = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ₪`;

/**
 * Cancellation: a parent stops a Plan under the cancellation policy. The Plan
 * ends today, used sessions stay used, and the policy's refund is proposed
 * step by step; a different amount needs a reason.
 */
export function CancelPlanDialog({ planId, onClose: close }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [defect, setDefect] = useState(false);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<RefundMethod>("none");
  const [amount, setAmount] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<{ refundId: string; receiptUrl: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const onClose = () => {
    if (done) router.refresh();
    close();
  };

  // The proposal changes with the defect box; the amount follows the proposal.
  const { preview, loadError } = usePlanPreview<CancellationPreview>(
    `${planId}:${defect}`,
    () => previewCancellationAction(planId, defect),
    (result) => {
      setMethod((m) => (m === "none" ? result.suggestedMethod : m));
      setAmount(result.proposal?.proposed ?? 0);
    },
  );

  const proposed = preview?.proposal?.proposed ?? 0;
  const overridden = preview !== null && amount !== proposed;

  const confirm = () =>
    startTransition(async () => {
      const result = await cancelPlanWithRefundAction({
        planId,
        readToken: preview?.readToken ?? "",
        reason,
        defect,
        method: amount === 0 ? "none" : method,
        reference,
        amountIls: amount,
        overrideReason: overridden ? overrideReason : "",
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cancelledCount > 0 ? `העסקה בוטלה. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.` : "העסקה בוטלה",
      );
      setDone({ refundId: result.refundId, receiptUrl: result.receiptUrl });
    });

  const canConfirm =
    reason.trim().length >= 2 && (!overridden || overrideReason.trim().length >= 2) && amount >= 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ביטול עסקה{preview ? `: ${preview.planName}` : ""}</DialogTitle>
          <DialogDescription>המסלול מסתיים היום, אימונים שנוצלו נשארים, וההחזר לפי מדיניות הביטול.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !preview ? (
          <Skeleton className="h-40 w-full" />
        ) : done ? (
          <CreditNoteStep refundId={done.refundId} receiptUrl={done.receiptUrl} onDone={onClose} />
        ) : preview.refusal || !preview.proposal ? (
          <p className="text-sm text-destructive">{preview.refusal ?? "לא ניתן לחשב החזר"}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="cancel-defect" checked={defect} onCheckedChange={(v) => setDefect(v === true)} disabled={pending} />
              <Label htmlFor="cancel-defect" className="font-normal">
                הביטול נובע מפגם או מאי-התאמה בשירות (ללא דמי ביטול)
              </Label>
            </div>

            <section aria-label="חישוב ההחזר" className="rounded-xl border p-3 text-sm">
              <ul className="space-y-1">
                {preview.proposal.steps.map((step) => (
                  <li key={step.label} className="flex justify-between gap-3">
                    <span>{step.label}</span>
                    <span className="tabular-nums">{shekels(step.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                <span>החזר מוצע</span>
                <span className="tabular-nums">{shekels(proposed)}</span>
              </div>
              {preview.singlePriceFromCardRate && preview.proposal.rule === "sessions" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  לא הוגדר מחיר אימון בודד לסניף; החישוב לפי מחיר כרטיסיית 10 חלקי 10.
                </p>
              )}
            </section>

            <AffectedBookings moved={preview.moved} cancelled={preview.cancelled} />

            <div className="space-y-1">
              <Label htmlFor="cancel-reason">סיבת הביטול</Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="למשל: ההורה ביקש לבטל בוואטסאפ"
                maxLength={300}
                disabled={pending}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cancel-amount">סכום ההחזר (₪)</Label>
                <Input
                  id="cancel-amount"
                  type="number"
                  min={0}
                  max={preview.amountPaid}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cancel-ref">אסמכתא (לא חובה)</Label>
                <Input id="cancel-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} disabled={pending} />
              </div>
            </div>

            {overridden && (
              <div className="space-y-1">
                <Label htmlFor="cancel-override">למה הסכום שונה מההצעה</Label>
                <Textarea
                  id="cancel-override"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="למשל: אישור רפואי, מחווה"
                  maxLength={300}
                  disabled={pending}
                />
              </div>
            )}

            {amount > 0 && (
              <div className="space-y-1">
                <Label htmlFor="refund-method">איך הכסף הוחזר</Label>
                <RefundMethodSelect value={method} onChange={setMethod} disabled={pending} />
              </div>
            )}

            <Button variant="destructive" className="w-full" onClick={confirm} disabled={pending || !canConfirm}>
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              ביטול העסקה
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
