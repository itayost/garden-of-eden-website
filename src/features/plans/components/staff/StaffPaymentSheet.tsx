"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/utils/iso-date";
import { toLocalPhone } from "@/lib/plans/local-phone";
import { arboxTermsFromProduct, type ArboxTermsDraft } from "@/lib/plans/arbox-terms";
import {
  getStaffPaymentContextAction,
  recordTraineePaymentAction,
  type StaffPaymentContext,
} from "../../lib/actions/staff-payment";
import { recordArboxPlanAction } from "../../lib/actions/staff-arbox-plan";
import { createPaymentLinkAction, type PaymentLinkResult as LinkResult } from "../../lib/actions/payment-link";
import { PaymentLinkResult } from "./PaymentLinkResult";
import type { ManualPaymentResult } from "../../lib/manual-payment";
import { ArboxTermsFields } from "./ArboxTermsFields";
import { DiscountFields } from "./DiscountFields";
import { FreeReasonField, freeReasonReady } from "./FreeReasonField";
import { ManualCardFields } from "./ManualCardFields";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readManualCard, type ManualCardDraft } from "@/lib/plans/manual-card";
import { useDiscount } from "./useDiscount";
import { DuplicatePrompt } from "./DuplicatePrompt";
import { PaymentMethodPicker, type PickerMethod } from "./PaymentMethodPicker";
import { PaymentResult } from "./PaymentResult";
import { ProductPicker } from "./ProductPicker";

const SHEET_METHODS: readonly PickerMethod[] = ["cash", "transfer", "bit", "free"];

/**
 * What the sheet offers: the hand-taken methods, a Payment link once online
 * card payments are open, and for Admins and Branch managers an Arbox sale
 * the import missed, as a repair.
 */
const methodsFor = (cardLinksOpen: boolean, managed: boolean): PickerMethod[] => [
  ...SHEET_METHODS,
  ...(cardLinksOpen ? (["card"] as const) : []),
  ...(managed ? (["arbox"] as const) : []),
];

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
  const [method, setMethod] = useState<PickerMethod>("cash");
  // Only while Arbox is chosen; re-filled from the product whenever it changes.
  const [arboxTerms, setArboxTerms] = useState<ArboxTermsDraft | null>(null);
  const [reference, setReference] = useState("");
  // Only offered when nothing is current or queued; otherwise the queue decides.
  const [startsOn, setStartsOn] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  // A Plan given without charging: its reason (any staff member).
  const [freeReason, setFreeReason] = useState("");
  const [duplicate, setDuplicate] = useState<number | null>(null);
  // What the sheet shows when done: a recorded payment, or a Payment link.
  const [done, setDone] = useState<{ kind: "paid"; result: ManualPaymentResult } | { kind: "link"; result: LinkResult } | null>(null);
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
      setStartsOn(ctx.today);
      setProductId(ctx.currentProductId && ctx.products.some((p) => p.id === ctx.currentProductId) ? ctx.currentProductId : (ctx.products[0]?.id ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [open, traineeId]);

  const selectedProduct = context?.products.find((p) => p.id === productId) ?? null;
  // A manual Card (Admin or the branch's manager): typed terms instead of a catalog product.
  const [manualDraft, setManualDraft] = useState<ManualCardDraft | null>(null);
  // A draft exists only while the context offers a manual Card (startManual), and resets on close.
  const manual = manualDraft ? readManualCard(manualDraft) : null;
  const saleProductId = manualDraft ? (context?.manualCard?.productId ?? null) : productId;
  const chooseKind = (kind: string) => {
    if (kind !== "manual" || !context?.manualCard) {
      setManualDraft(null);
      return;
    }
    setManualDraft(context.manualCard.draft);
    if (method === "arbox") setMethod("cash");
  };
  // A start can be chosen when nothing is current or queued, and always for an
  // Add-on, which sits outside the queue (a manual Card is a Card, never an Add-on).
  // A Payment link's Plan joins the queue when the parent pays: no start to choose.
  const canChooseStart =
    method !== "card" && context !== null && (!context.startsAfterCurrent || (!manualDraft && selectedProduct?.kind === "addon"));
  const startsLater = canChooseStart && context !== null && startsOn > context.today;

  const prefillArbox = (nextProductId: string | null) => {
    const product = context?.products.find((p) => p.id === nextProductId);
    setArboxTerms(product && context ? arboxTermsFromProduct(product, context.startsOn) : null);
  };

  const chooseMethod = (next: PickerMethod) => {
    setMethod(next);
    if (next === "arbox") prefillArbox(productId);
    else setArboxTerms(null);
  };

  // Admins and the branch's manager: an Arbox repair, or a Discount.
  const isManaged = (id: string | null) => context?.products.find((p) => p.id === id)?.managed ?? false;
  const free = method === "free";
  const discount = useDiscount(selectedProduct, method !== "arbox" && !free && !manualDraft);

  const chooseProduct = (next: string) => {
    setProductId(next);
    discount.reset();
    if (method !== "arbox") return;
    if (isManaged(next)) prefillArbox(next);
    else chooseMethod("cash");
  };

  const submitArbox = (confirmDuplicate: boolean) => {
    if (!productId || !arboxTerms || !selectedProduct) return;
    startTransition(async () => {
      const outcome = await recordArboxPlanAction({
        traineeId,
        productId,
        startsOn: arboxTerms.startsOn,
        endsOn: arboxTerms.endsOn,
        sessionsTotal: selectedProduct.sessions_total === null ? null : Number(arboxTerms.sessionsTotal),
        amountIls: Number(arboxTerms.amountIls),
        reference,
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
      toast.success(`המסלול נוצר: ${shortDate(outcome.startsOn)} עד ${shortDate(outcome.endsOn)}`);
      finish(true);
    });
  };

  const submitLink = () => {
    if (!saleProductId) return;
    startTransition(async () => {
      const outcome = await createPaymentLinkAction({
        traineeId,
        productId: saleProductId,
        sendWhatsApp,
        discount: discount.discount,
        manualCard: manual?.terms ?? null,
      });
      if ("error" in outcome) {
        toast.error(outcome.error);
        return;
      }
      setDone({ kind: "link", result: outcome });
    });
  };

  const submit = (confirmDuplicate = false) => {
    if (!saleProductId) return;
    if (method === "arbox") {
      submitArbox(confirmDuplicate);
      return;
    }
    if (method === "card") {
      submitLink();
      return;
    }
    startTransition(async () => {
      const outcome = await recordTraineePaymentAction({
        traineeId,
        productId: saleProductId,
        manualCard: manual?.terms ?? null,
        paymentMethod: method,
        reference,
        startsOn: canChooseStart ? startsOn : null,
        sendWhatsApp,
        discount: discount.discount,
        freeReason: free ? freeReason : null,
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
      setDone({ kind: "paid", result: outcome });
    });
  };

  // State resets on close, not in the effect: the next open reloads fresh.
  const finish = (paid: boolean) => {
    onOpenChange(false, paid);
    if (paid) router.refresh();
    setDone(null);
    setFreeReason("");
    setManualDraft(null);
    setDuplicate(null);
    setMethod("cash");
    setArboxTerms(null);
    discount.reset();
    setReference("");
    setContext(null);
    setLoadError(null);
  };
  // A Payment link sold nothing yet: the sheet closes as unpaid.
  const close = () => finish(done?.kind === "paid");

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
          <DialogTitle>
            {done?.kind === "paid" ? "נרשם" : done ? "קישור לתשלום" : `רישום תשלום${context ? ` · ${context.traineeName}` : ""}`}
          </DialogTitle>
          <DialogDescription>
            {done
              ? "מה ההורה קיבל"
              : context
                ? method === "card"
                  ? "ההורה יקבל קישור לחתימה ולתשלום באשראי. המסלול יצטרף לתור אחרי התשלום."
                  : method === "arbox"
                  ? "התאריכים, האימונים והסכום כמו שנמכרו ב-Arbox."
                  : startsLater
                  ? `המסלול החדש יתחיל ב-${shortDate(startsOn)}.`
                  : context.startsWhenCardRunsOut
                  ? `המסלול החדש יתחיל כשהכרטיסייה הנוכחית תיגמר, לכל המאוחר ב-${shortDate(context.startsOn)}.`
                  : context.startsAfterCurrent
                  ? `המסלול החדש יתחיל ב-${shortDate(context.startsOn)}, אחרי סיום המסלול הנוכחי.`
                  : "המסלול החדש מתחיל היום."
                : "טוען..."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {done?.kind === "paid" ? (
            <PaymentResult result={done.result} isAdmin={isAdmin} onClose={close} />
          ) : done ? (
            <PaymentLinkResult result={done.result} onClose={close} />
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
              {context.manualCard && (
                <Tabs value={manualDraft ? "manual" : "catalog"} onValueChange={chooseKind}>
                  <TabsList className="w-full" aria-label="סוג מסלול">
                    <TabsTrigger value="catalog" className="flex-1" disabled={pending}>
                      מהמחירון
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1" disabled={pending}>
                      כרטיסייה ידנית
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {manualDraft ? (
                <ManualCardFields value={manualDraft} onChange={setManualDraft} problem={manual?.problem ?? null} disabled={pending} />
              ) : (
                <ProductPicker products={context.products} selectedId={productId} onSelect={chooseProduct} disabled={pending} />
              )}
              <PaymentMethodPicker
                methods={methodsFor(context.cardLinksOpen, !manualDraft && isManaged(productId))}
                method={method}
                reference={reference}
                onMethodChange={chooseMethod}
                onReferenceChange={setReference}
                disabled={pending}
              />
              {method === "arbox" && arboxTerms && selectedProduct ? (
                <>
                  <ArboxTermsFields
                    value={arboxTerms}
                    onChange={setArboxTerms}
                    hasSessions={selectedProduct.sessions_total !== null}
                    disabled={pending}
                  />
                  <p className="text-xs text-muted-foreground">
                    לא תופק קבלה ולא יישלח וואטסאפ: הקבלה והחתימה נמצאות ב-Arbox.
                  </p>
                </>
              ) : (
                <>
                  {free && <FreeReasonField idPrefix="sp" value={freeReason} onChange={setFreeReason} disabled={pending} />}
                  {discount.offered && selectedProduct && (
                    <DiscountFields
                      idPrefix="sp"
                      listPrice={selectedProduct.price_ils}
                      value={discount.draft}
                      onChange={discount.setDraft}
                      problem={discount.problem}
                      disabled={pending}
                    />
                  )}
                  {canChooseStart && (
                    <div className="space-y-1">
                      <Label htmlFor="sp-start">תאריך תחילה</Label>
                      <Input
                        id="sp-start"
                        type="date"
                        className="h-12 rounded-xl text-base"
                        value={startsOn}
                        min={context.today}
                        max={context.latestStartOn}
                        onChange={(e) => setStartsOn(e.target.value)}
                        disabled={pending}
                      />
                      <p className="text-xs text-muted-foreground">היום, או עד 30 יום קדימה אם התשלום מקדים את האימון הראשון.</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <Label htmlFor="sp-wa" className="leading-snug">
                      {method === "card" ? "שלח להורה את הקישור לתשלום בוואטסאפ" : "שלח אישור וקישור לחתימה בוואטסאפ"}
                      {context.parentPhone && (
                        <span className="block text-xs font-normal text-muted-foreground" dir="ltr">
                          {toLocalPhone(context.parentPhone)}
                        </span>
                      )}
                    </Label>
                    <Switch id="sp-wa" checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} disabled={pending} />
                  </div>
                  {method !== "card" && (
                    <p className="text-xs text-muted-foreground">
                      {context.morningConfigured ? "חשבונית מס קבלה תופק אוטומטית ב-Morning." : "חשבונית תופק ידנית ב-Morning עד שהחיבור יוגדר."}
                    </p>
                  )}
                </>
              )}
              {duplicate !== null ? (
                <DuplicatePrompt minutesAgo={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} pending={pending} />
              ) : (
                <Button className="h-12 w-full rounded-full text-base" onClick={() => submit(false)} disabled={pending || !saleProductId || Boolean(discount.problem) || Boolean(manual?.problem) || (free && !freeReasonReady(freeReason))}>
                  {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                  {method === "arbox" ? "יצירת המסלול" : method === "card" ? "יצירת קישור לתשלום" : "רישום התשלום"}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetDialogContent>
    </Dialog>
  );
}
