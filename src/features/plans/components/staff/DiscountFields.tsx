"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { readDiscount, type DiscountDraft } from "@/lib/plans/discount";

/**
 * A sale below list price, for Admins and the branch's manager only. The
 * receipt and the agreement show the amount paid.
 */
export function DiscountFields({
  idPrefix,
  listPrice,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  listPrice: number;
  value: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  disabled?: boolean;
}) {
  const { problem } = readDiscount(value, listPrice);
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${idPrefix}-discount`}>הנחה (מחיר מחירון ₪{listPrice.toLocaleString("he-IL")})</Label>
        <Switch
          id={`${idPrefix}-discount`}
          checked={value.on}
          onCheckedChange={(on) => onChange({ ...value, on })}
          disabled={disabled}
        />
      </div>
      {value.on && (
        <>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-discount-amount`}>סכום לתשלום (₪)</Label>
            <Input
              id={`${idPrefix}-discount-amount`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="h-12 rounded-xl text-base"
              value={value.amount}
              onChange={(e) => onChange({ ...value, amount: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-discount-reason`}>סיבת ההנחה</Label>
            <Textarea
              id={`${idPrefix}-discount-reason`}
              rows={2}
              placeholder="למשל: אח שני, מלגה"
              value={value.reason}
              onChange={(e) => onChange({ ...value, reason: e.target.value })}
              maxLength={300}
              disabled={disabled}
            />
          </div>
          {/* Nothing to correct until an amount is typed. */}
          {problem && value.amount !== "" && <p className="text-xs text-destructive">{problem}</p>}
          <p className="text-xs text-muted-foreground">הקבלה וההסכם יציגו את הסכום ששולם.</p>
        </>
      )}
    </div>
  );
}
