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
import type { PlanProduct } from "@/types/plans";
import { israelToday } from "@/lib/utils/tasks";
import { createTraineeWithPaymentAction } from "../../lib/actions/staff-payment";
import type { ManualPaymentResult } from "../../lib/manual-payment";
import { DuplicatePrompt } from "./DuplicatePrompt";
import { PaymentMethodPicker } from "./PaymentMethodPicker";
import { PaymentResult } from "./PaymentResult";
import { ProductPicker } from "./ProductPicker";


interface NewTraineeSheetProps {
  products: PlanProduct[];
  morningConfigured: boolean;
  isAdmin: boolean;
}

interface FormState {
  productId: string;
  childName: string;
  loginPhone: string;
  sameNumber: boolean;
  payerPhone: string;
  parentName: string;
  paymentMethod: ManualPaymentMethod;
  reference: string;
  startsOn: string;
  sendWhatsApp: boolean;
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
  startsOn: israelToday(),
  sendWhatsApp: true,
});

/**
 * A new trainee at the field: the child, two phones, the plan, the money.
 * Everything else the parent fills in when signing from the WhatsApp link.
 */
export function NewTraineeSheet({ products, morningConfigured, isAdmin }: NewTraineeSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [duplicate, setDuplicate] = useState<number | null>(null);
  const [result, setResult] = useState<ManualPaymentResult | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toInput = (confirmDuplicate: boolean): NewTraineeInput => ({
    productId: form.productId,
    childName: form.childName,
    loginPhone: form.loginPhone,
    payerPhone: form.sameNumber ? form.loginPhone : form.payerPhone,
    parentName: form.parentName,
    paymentMethod: form.paymentMethod,
    reference: form.reference,
    startsOn: form.startsOn,
    sendWhatsApp: form.sendWhatsApp,
    confirmDuplicate,
  });

  const submit = (confirmDuplicate = false) =>
    startTransition(async () => {
      const outcome = await createTraineeWithPaymentAction(toInput(confirmDuplicate));
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

  const close = () => {
    setOpen(false);
    if (result) router.refresh();
    setResult(null);
    setDuplicate(null);
    setForm(emptyForm());
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
            <DialogTitle>{result ? "נרשם" : "מתאמן חדש"}</DialogTitle>
            <DialogDescription>
              {result
                ? "מה ההורה קיבל"
                : "רק מה שההורה לא יכול למלא בעצמו. את השאר ההורה משלים בחתימה מהוואטסאפ."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {result ? (
              <PaymentResult result={result} isAdmin={isAdmin} onClose={close} />
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

                <ProductPicker products={products} selectedId={form.productId || null} onSelect={(id) => set("productId", id)} disabled={pending} />

                <PaymentMethodPicker
                  method={form.paymentMethod}
                  reference={form.reference}
                  onMethodChange={(m) => set("paymentMethod", m)}
                  onReferenceChange={(r) => set("reference", r)}
                  disabled={pending}
                />

                <div className="space-y-1">
                  <Label htmlFor="nt-start">תאריך תחילה</Label>
                  <Input id="nt-start" type="date" className="h-12 rounded-xl text-base" value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} disabled={pending} />
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <Label htmlFor="nt-wa">שלח אישור וקישור לחתימה בוואטסאפ</Label>
                  <Switch id="nt-wa" checked={form.sendWhatsApp} onCheckedChange={(v) => set("sendWhatsApp", v)} disabled={pending} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {morningConfigured ? "חשבונית מס קבלה תופק אוטומטית ב-Morning." : "חשבונית תופק ידנית ב-Morning עד שהחיבור יוגדר."}
                </p>

                {duplicate !== null ? (
                  <DuplicatePrompt minutesAgo={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} pending={pending} />
                ) : (
                  <Button className="h-12 w-full rounded-full text-base" onClick={() => submit(false)} disabled={pending || !form.productId || !form.childName || !form.loginPhone}>
                    {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                    רישום התשלום
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
