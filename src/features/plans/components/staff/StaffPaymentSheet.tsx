"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/utils/iso-date";
import { toLocalPhone } from "@/lib/plans/local-phone";
import type { ManualPaymentMethod } from "@/lib/validations/plans-admin";
import {
  getStaffPaymentContextAction,
  recordTraineePaymentAction,
  type StaffPaymentContext,
} from "../../lib/actions/staff-payment";
import type { ManualPaymentResult } from "../../lib/manual-payment";
import { DuplicatePrompt } from "./DuplicatePrompt";
import { PaymentMethodPicker } from "./PaymentMethodPicker";
import { PaymentResult } from "./PaymentResult";
import { ProductPicker } from "./ProductPicker";

interface StaffPaymentSheetProps {
  traineeId: string;
  isAdmin: boolean;
  open: boolean;
  /** `paid` is true when the sheet closes after a recorded payment. */
  onOpenChange: (open: boolean, paid?: boolean) => void;
}

/**
 * A payment for a trainee who already has an account. Opens with the
 * current plan's product preselected and says when the new plan starts;
 * chaining after a running plan is automatic.
 */
export function StaffPaymentSheet({ traineeId, isAdmin, open, onOpenChange }: StaffPaymentSheetProps) {
  const router = useRouter();
  const [context, setContext] = useState<StaffPaymentContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [duplicate, setDuplicate] = useState<number | null>(null);
  const [result, setResult] = useState<ManualPaymentResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getStaffPaymentContextAction(traineeId).then((ctx) => {
      if (cancelled) return;
      if ("error" in ctx) {
        setLoadError(ctx.error);
        return;
      }
      setContext(ctx);
      setProductId(ctx.currentProductId && ctx.products.some((p) => p.id === ctx.currentProductId) ? ctx.currentProductId : (ctx.products[0]?.id ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [open, traineeId]);

  const submit = (confirmDuplicate = false) => {
    if (!productId) return;
    startTransition(async () => {
      const outcome = await recordTraineePaymentAction({
        traineeId,
        productId,
        paymentMethod: method,
        reference,
        sendWhatsApp,
        confirmDuplicate,
      });
      if ("error" in outcome) {
        toast.error(outcome.error);
        return;
      }
      if ("duplicate" in outcome) {
        setDuplicate(outcome.duplicate.minutesAgo);
        return;
      }
      setDuplicate(null);
      setResult(outcome);
    });
  };

  // State resets on close, not in the effect: the next open reloads fresh.
  const close = () => {
    onOpenChange(false, result !== null);
    if (result) router.refresh();
    setResult(null);
    setDuplicate(null);
    setMethod("cash");
    setReference("");
    setContext(null);
    setLoadError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
          <DialogTitle>{result ? "נרשם" : `רישום תשלום${context ? ` · ${context.traineeName}` : ""}`}</DialogTitle>
          <DialogDescription>
            {result
              ? "מה ההורה קיבל"
              : context
                ? context.startsAfterCurrent
                  ? `המסלול החדש יתחיל ב-${shortDate(context.startsOn)}, אחרי סיום המסלול הנוכחי.`
                  : "המסלול החדש מתחיל היום."
                : "טוען..."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {result ? (
            <PaymentResult result={result} isAdmin={isAdmin} onClose={close} />
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !context ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : context.products.length === 0 ? (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              המסלולים באפליקציה זמינים לסניף קריית אתא. מתאמן בחיפה מנוהל ב-Arbox; כדי לרשום לו מסלול כאן, שייכו אותו קודם לסניף קריית אתא.
            </p>
          ) : (
            <>
              <ProductPicker products={context.products} selectedId={productId} onSelect={setProductId} disabled={pending} />
              <PaymentMethodPicker method={method} reference={reference} onMethodChange={setMethod} onReferenceChange={setReference} disabled={pending} />
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="sp-wa" className="leading-snug">
                  שלח אישור וקישור לחתימה בוואטסאפ
                  {context.parentPhone && (
                    <span className="block text-xs font-normal text-muted-foreground" dir="ltr">
                      {toLocalPhone(context.parentPhone)}
                    </span>
                  )}
                </Label>
                <Switch id="sp-wa" checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} disabled={pending} />
              </div>
              <p className="text-xs text-muted-foreground">
                {context.morningConfigured ? "חשבונית מס קבלה תופק אוטומטית ב-Morning." : "חשבונית תופק ידנית ב-Morning עד שהחיבור יוגדר."}
              </p>
              {duplicate !== null ? (
                <DuplicatePrompt minutesAgo={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} pending={pending} />
              ) : (
                <Button className="h-12 w-full rounded-full text-base" onClick={() => submit(false)} disabled={pending || !productId}>
                  {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                  רישום התשלום
                </Button>
              )}
            </>
          )}
        </div>
      </SheetDialogContent>
    </Dialog>
  );
}
