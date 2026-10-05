"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ddmmyyyy } from "@/lib/plans/confirmation-copy";
import type { RefundMethod } from "@/lib/validations/plans-admin";
import {
  previewVoidAction,
  recordCreditNoteAction,
  voidPlanAction,
  type AffectedBooking,
  type VoidPreview,
} from "../../lib/actions/void-plan";

const METHOD_LABELS: Record<RefundMethod, string> = {
  card: "זיכוי כרטיס ב-Pelecard",
  cash: "מזומן",
  transfer: "העברה בנקאית",
  bit: "ביט",
  arbox: "הוחזר ב-Arbox",
  none: "לא שולם כסף",
};

function BookingList({ title, items, tone }: { title: string; items: AffectedBooking[]; tone: "moved" | "cancelled" }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <ul className={tone === "cancelled" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {items.map((b) => (
          <li key={`${b.date} ${b.time}`}>
            {ddmmyyyy(b.date)} בשעה {b.time}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const [creditNote, setCreditNote] = useState("");
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

  const saveCreditNote = () =>
    startTransition(async () => {
      if (!done) return;
      const result = await recordCreditNoteAction({ refundId: done.refundId, creditNoteNumber: creditNote });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("מספר הזיכוי נשמר");
      onClose();
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
          <div className="space-y-4 text-sm">
            <p>הרישום בוטל ונשמר רישום ההחזר.</p>
            {done.receiptUrl ? (
              <>
                <p>
                  עכשיו מפיקים ב-Morning חשבונית זיכוי וקבלה שלילית לקבלה המקורית, ורושמים כאן את מספר חשבונית הזיכוי.
                </p>
                <a href={done.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  <ExternalLink className="h-4 w-4" />
                  הקבלה המקורית ב-Morning
                </a>
                <div className="flex gap-2">
                  <Input
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="מספר חשבונית הזיכוי"
                    aria-label="מספר חשבונית הזיכוי"
                    disabled={pending}
                  />
                  <Button onClick={saveCreditNote} disabled={pending || creditNote.trim() === ""}>
                    שמירה
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">להזמנה אין קבלה ב-Morning, ולכן אין מה לזכות שם.</p>
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>
              סגירה
            </Button>
          </div>
        ) : preview.refusal ? (
          <p className="text-sm text-destructive">{preview.refusal}</p>
        ) : (
          <div className="space-y-4">
            <BookingList title="אימונים שיעברו למסלול הבא בתור" items={preview.moved} tone="moved" />
            <BookingList title="אימונים שיבוטלו (המתאמן יקבל הודעה)" items={preview.cancelled} tone="cancelled" />

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
              <Label htmlFor="void-method">איך הכסף הוחזר</Label>
              <select
                id="void-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as RefundMethod)}
                disabled={pending}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(METHOD_LABELS) as RefundMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
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
