"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { grantPlanAction } from "../../lib/actions/admin-plans";
import { manualPaymentMethodSchema, type ManualGrantInput } from "@/lib/validations/plans-admin";
import { PAYMENT_METHOD_LABELS_HE } from "@/types/plans";
import type { PlanProduct } from "@/types/plans";

type TextKey = Exclude<keyof ManualGrantInput, "paymentMethod">;

function emptyForm(): ManualGrantInput {
  return {
    productId: "",
    parentName: "",
    payerPhone: "",
    loginPhone: "",
    childName: "",
    childBirthdate: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalNotes: "",
    paymentMethod: "cash",
    note: "",
    startsOn: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()),
  };
}

const PAYMENT_METHODS = manualPaymentMethodSchema.options;

export function ManualGrantDialog({ products }: { products: PlanProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualGrantInput>(emptyForm);
  const [pending, startTransition] = useTransition();

  const setText = (key: TextKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    startTransition(async () => {
      const result = await grantPlanAction(form);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("המסלול נוצר והחניך קיבל חשבון");
      setForm(emptyForm());
      setOpen(false);
      router.refresh();
    });
  };

  const field = (
    key: TextKey,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`grant-${key}`}>{label}</Label>
      <Input
        id={`grant-${key}`}
        value={form[key] ?? ""}
        onChange={(e) => setText(key, e.target.value)}
        disabled={pending}
        {...props}
      />
    </div>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 ms-2" />
        הרשמה ידנית
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>הרשמה ידנית (מזומן / העברה)</DialogTitle>
            <DialogDescription>
              יוצר חשבון, שיוך לסניף ומסלול, בדיוק כמו רכישה באתר.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>מסלול</Label>
              <Select
                value={form.productId}
                onValueChange={(v) => setText("productId", v)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מסלול" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_he} (₪{p.price_ils})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("parentName", "שם ההורה")}
            {field("payerPhone", "טלפון ההורה", { dir: "ltr", className: "text-right" })}
            {field("childName", "שם החניך")}
            {field("childBirthdate", "תאריך לידה", { type: "date" })}
            {field("loginPhone", "טלפון וואטסאפ להתחברות", { dir: "ltr", className: "text-right" })}
            {field("email", 'דוא"ל', { type: "email", dir: "ltr", className: "text-right" })}
            {field("emergencyContactName", "איש קשר לחירום")}
            {field("emergencyContactPhone", "טלפון לחירום", { dir: "ltr", className: "text-right" })}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="grant-medical">מגבלות רפואיות</Label>
              <Textarea
                id="grant-medical"
                rows={2}
                value={form.medicalNotes ?? ""}
                onChange={(e) => setText("medicalNotes", e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label>אמצעי תשלום</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentMethod: v as ManualGrantInput["paymentMethod"],
                  }))
                }
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAYMENT_METHOD_LABELS_HE[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("startsOn", "תאריך תחילה", { type: "date" })}
            {field("note", "הערה (למשל מספר קבלה)")}
          </div>
          <Button onClick={submit} disabled={pending || !form.productId} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            יצירת מסלול
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
