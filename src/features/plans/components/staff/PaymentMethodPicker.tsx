"use client";

import { Banknote, Dumbbell, Landmark, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ManualPaymentMethod } from "@/lib/validations/plans-admin";
import { PAYMENT_METHOD_LABELS_HE } from "@/types/plans";

/** What a staff sheet may offer: the hand-taken methods, and a plan paid in Arbox. */
export type PickerMethod = ManualPaymentMethod | "arbox";

const ICONS: Record<PickerMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: Landmark,
  bit: Smartphone,
  arbox: Dumbbell,
};

const MANUAL_METHODS: readonly ManualPaymentMethod[] = ["cash", "transfer", "bit"];

const REFERENCE_COPY: Record<Exclude<PickerMethod, "cash">, { label: string; placeholder: string }> = {
  transfer: { label: "אסמכתא (לא חובה)", placeholder: "4 ספרות אחרונות של האסמכתא" },
  bit: { label: "אסמכתא (לא חובה)", placeholder: "4 ספרות אחרונות של האסמכתא" },
  arbox: { label: "מספר המנוי או הקבלה ב-Arbox (לא חובה)", placeholder: "לדוגמה 18554133" },
};

interface PaymentMethodPickerProps<M extends PickerMethod> {
  method: M;
  reference: string;
  onMethodChange: (method: M) => void;
  onReferenceChange: (reference: string) => void;
  /** The methods to offer, in order. Defaults to cash, transfer, and Bit. */
  methods?: readonly M[];
  disabled?: boolean;
}

/** Thumb-sized buttons; the reference field appears where a reference exists. */
export function PaymentMethodPicker<M extends PickerMethod>({
  method,
  reference,
  onMethodChange,
  onReferenceChange,
  methods = MANUAL_METHODS as readonly M[],
  disabled,
}: PaymentMethodPickerProps<M>) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-2 block">אמצעי תשלום</Label>
        <div
          className={cn("grid gap-2", methods.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}
          role="radiogroup"
          aria-label="אמצעי תשלום"
        >
          {methods.map((value) => {
            const Icon: typeof Banknote = ICONS[value as PickerMethod];
            const selected = method === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  onMethodChange(value);
                  if (value === "cash") onReferenceChange("");
                }}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors",
                  selected
                    ? "border-forest bg-forest text-cream"
                    : "border-border bg-background hover:border-forest/50",
                )}
              >
                <Icon className="h-5 w-5" />
                {PAYMENT_METHOD_LABELS_HE[value]}
              </button>
            );
          })}
        </div>
      </div>
      {method !== "cash" && (
        <div className="space-y-1">
          <Label htmlFor="payment-reference">{REFERENCE_COPY[method as Exclude<PickerMethod, "cash">].label}</Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder={REFERENCE_COPY[method as Exclude<PickerMethod, "cash">].placeholder}
            inputMode="numeric"
            dir="ltr"
            className="h-12 rounded-xl text-base text-right"
            maxLength={60}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
