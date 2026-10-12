"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ManualPaymentMethod, NewTraineeInput } from "@/lib/validations/plans-admin";
import { israelToday } from "@/lib/utils/tasks";
import { latestStartDate } from "@/lib/plans/start-date";
import { createTraineeWithPaymentAction, type SellableProduct } from "../../lib/actions/staff-payment";
import { createNewTraineePaymentLinkAction } from "../../lib/actions/payment-link";
import { DiscountFields } from "./DiscountFields";
import { FreeReasonField, freeReasonReady } from "./FreeReasonField";
import { useDiscount } from "./useDiscount";
import { DuplicatePrompt } from "./DuplicatePrompt";
import { PaymentLinkResult, type SheetDone } from "./PaymentLinkResult";
import { EMPTY_CHEQUE, handMethods, PaymentMethodPicker } from "./PaymentMethodPicker";
import type { ChequeBankDraft } from "@/lib/plans/cheque";
import { PaymentResult } from "./PaymentResult";
import { ProductPicker } from "./ProductPicker";

type SheetMethod = ManualPaymentMethod | "card";

interface NewTraineeSheetProps {
  products: SellableProduct[];
  morningConfigured: boolean;
  /** Online card payments are open, so staff may send a Payment link. */
  cardLinksOpen: boolean;
  isAdmin: boolean;
}

interface FormState {
  productId: string;
  childName: string;
  loginPhone: string;
  sameNumber: boolean;
  payerPhone: string;
  parentName: string;
  paymentMethod: SheetMethod;
  reference: string;
  /** A cheque's bank, branch and account (method check). */
  cheque: ChequeBankDraft;
  startsOn: string;
  sendWhatsApp: boolean;
  /** Why the Plan is given without charging (method free). */
  freeReason: string;
}

const emptyForm = (): FormState => ({
  productId: "",
  childName: "",
  loginPhone: "",
  sameNumber: true,
  payerPhone: "",
  parentName: "",
  paymentMethod: "cash",
  reference: "",
  cheque: EMPTY_CHEQUE,
  startsOn: israelToday(),
  sendWhatsApp: true,
  freeReason: "",
});

/**
 * A new trainee at the field: the child, two phones, the plan, the money.
 * Everything else the parent fills in when signing from the WhatsApp link.
 */
export function NewTraineeSheet({ products, morningConfigured, cardLinksOpen, isAdmin }: NewTraineeSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [duplicate, setDuplicate] = useState<number | null>(null);
  const [done, setDone] = useState<SheetDone | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const product = products.find((p) => p.id === form.productId) ?? null;
  // Admins and the branch's manager may sell below list price.
  const free = form.paymentMethod === "free";
  const card = form.paymentMethod === "card";
  const discount = useDiscount(product, !free);

  const people = () => ({
    productId: form.productId,
    childName: form.childName,
    loginPhone: form.loginPhone,
    payerPhone: form.sameNumber ? form.loginPhone : form.payerPhone,
    parentName: form.parentName,
    sendWhatsApp: form.sendWhatsApp,
    discount: discount.discount,
  });

  const toInput = (paymentMethod: ManualPaymentMethod, confirmDuplicate: boolean): NewTraineeInput => ({
    ...people(),
    paymentMethod,
    reference: form.reference,
    cheque: paymentMethod === "check" ? form.cheque : null,
    startsOn: form.startsOn,
    freeReason: free ? form.freeReason : null,
    confirmDuplicate,
  });

  const submit = (confirmDuplicate = false) => {
    const paymentMethod = form.paymentMethod;
    startTransition(async () => {
      if (paymentMethod === "card") {
        const link = await createNewTraineePaymentLinkAction(people());
        if ("error" in link) toast.error(link.error);
        else setDone({ kind: "link", result: link });
        return;
      }
      const outcome = await createTraineeWithPaymentAction(toInput(paymentMethod, confirmDuplicate));
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

  const close = () => {
    setOpen(false);
    if (done) router.refresh();
    setDone(null);
    setDuplicate(null);
    setForm(emptyForm());
    discount.reset();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 me-2" />
        מתאמן חדש
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <SheetDialogContent>
          <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
            <DialogTitle>{done?.kind === "paid" ? "נרשם" : done ? "קישור לתשלום" : "מתאמן חדש"}</DialogTitle>
            <DialogDescription>
              {done
                ? "מה ההורה קיבל"
                : card
                  ? "ההורה יקבל קישור לחתימה ולתשלום באשראי. המתאמן נוסף עכשיו, המסלול נפתח אחרי התשלום."
                  : "רק מה שההורה לא יכול למלא בעצמו. את השאר ההורה משלים בחתימה מהוואטסאפ."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {done?.kind === "paid" ? (
              <PaymentResult result={done.result} isAdmin={isAdmin} onClose={close} />
            ) : done ? (
              <PaymentLinkResult result={done.result} onClose={close} />
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="nt-child">שם החניך/ה</Label>
                  <Input id="nt-child" className="h-12 rounded-xl text-base" value={form.childName} onChange={(e) => set("childName", e.target.value)} disabled={pending} autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nt-login">טלפון וואטסאפ של החניך (להתחברות)</Label>
                  <Input id="nt-login" type="tel" inputMode="tel" dir="ltr" className="h-12 rounded-xl text-base text-right" placeholder="0521234567" value={form.loginPhone} onChange={(e) => set("loginPhone", e.target.value)} disabled={pending} autoComplete="off" />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <Label htmlFor="nt-same">ההורה משתמש באותו מספר</Label>
                  <Switch id="nt-same" checked={form.sameNumber} onCheckedChange={(v) => set("sameNumber", v)} disabled={pending} />
                </div>
                {!form.sameNumber && (
                  <div className="space-y-1">
                    <Label htmlFor="nt-payer">טלפון ההורה</Label>
                    <Input id="nt-payer" type="tel" inputMode="tel" dir="ltr" className="h-12 rounded-xl text-base text-right" placeholder="0501234567" value={form.payerPhone} onChange={(e) => set("payerPhone", e.target.value)} disabled={pending} autoComplete="off" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="nt-parent">שם ההורה (לא חובה)</Label>
                  <Input id="nt-parent" className="h-12 rounded-xl text-base" value={form.parentName} onChange={(e) => set("parentName", e.target.value)} disabled={pending} autoComplete="off" />
                </div>

                <ProductPicker products={products} selectedId={form.productId || null} onSelect={(id) => {
                    set("productId", id);
                    discount.reset();
                  }} disabled={pending} />

                {discount.offered && product && (
                  <DiscountFields
                    idPrefix="nt"
                    listPrice={product.price_ils}
                    value={discount.draft}
                    onChange={discount.setDraft}
                    problem={discount.problem}
                    disabled={pending}
                  />
                )}

                <PaymentMethodPicker
                  methods={handMethods(cardLinksOpen)}
                  method={form.paymentMethod}
                  reference={form.reference}
                  onMethodChange={(m) => {
                    set("paymentMethod", m);
                    // The duplicate prompt answers the method it was raised for.
                    setDuplicate(null);
                  }}
                  onReferenceChange={(r) => set("reference", r)}
                  cheque={form.cheque}
                  onChequeChange={(c) => set("cheque", c)}
                  disabled={pending}
                />
                {free && (
                  <FreeReasonField idPrefix="nt" value={form.freeReason} onChange={(r) => set("freeReason", r)} disabled={pending} />
                )}

                {!card && (
                  <div className="space-y-1">
                    <Label htmlFor="nt-start">תאריך תחילה</Label>
                    <Input
                      id="nt-start"
                      type="date"
                      className="h-12 rounded-xl text-base"
                      value={form.startsOn}
                      min={israelToday()}
                      max={latestStartDate(israelToday())}
                      onChange={(e) => set("startsOn", e.target.value)}
                      disabled={pending}
                    />
                    <p className="text-xs text-muted-foreground">היום או עד 30 יום קדימה. למתאמן עם מסלול פעיל המסלול החדש מתחיל אחריו.</p>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <Label htmlFor="nt-wa">{card ? "שלח להורה את הקישור לתשלום בוואטסאפ" : "שלח אישור וקישור לחתימה בוואטסאפ"}</Label>
                  <Switch id="nt-wa" checked={form.sendWhatsApp} onCheckedChange={(v) => set("sendWhatsApp", v)} disabled={pending} />
                </div>
                {!free && !card && (
                  <p className="text-xs text-muted-foreground">
                    {morningConfigured ? "חשבונית מס קבלה תופק אוטומטית ב-Morning." : "חשבונית תופק ידנית ב-Morning עד שהחיבור יוגדר."}
                  </p>
                )}

                {duplicate !== null ? (
                  <DuplicatePrompt minutesAgo={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} pending={pending} />
                ) : (
                  <Button className="h-12 w-full rounded-full text-base" onClick={() => submit(false)} disabled={pending || !form.productId || !form.childName || !form.loginPhone || Boolean(discount.problem) || (free && !freeReasonReady(form.freeReason))}>
                    {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                    {card ? "יצירת קישור לתשלום" : "רישום התשלום"}
                  </Button>
                )}
              </>
            )}
          </div>
        </SheetDialogContent>
      </Dialog>
    </>
  );
}
