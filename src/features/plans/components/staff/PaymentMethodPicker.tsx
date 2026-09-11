"use client";

import { Banknote, Landmark, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ManualPaymentMethod } from "@/lib/validations/plans-admin";
import { PAYMENT_METHOD_LABELS_HE } from "@/types/plans";

const METHODS: { value: ManualPaymentMethod; icon: typeof Banknote }[] = [
  { value: "cash", icon: Banknote },
  { value: "transfer", icon: Landmark },
  { value: "bit", icon: Smartphone },
];

interface PaymentMethodPickerProps {
  method: ManualPaymentMethod;
  reference: string;
  onMethodChange: (method: ManualPaymentMethod) => void;
  onReferenceChange: (reference: string) => void;
  disabled?: boolean;
}

/** Three thumb-sized buttons; the reference field appears where a reference exists. */
export function PaymentMethodPicker({
  method,
  reference,
  onMethodChange,
  onReferenceChange,
  disabled,
}: PaymentMethodPickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-2 block">אמצעי תשלום</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="אמצעי תשלום">
          {METHODS.map(({ value, icon: Icon }) => {
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
          <Label htmlFor="payment-reference">אסמכתא (לא חובה)</Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder="4 ספרות אחרונות של האסמכתא"
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
