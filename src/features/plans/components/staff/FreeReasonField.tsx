"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Why a Plan is given without charging: required, shown on the orders list. */
export function FreeReasonField({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-free-reason`}>סיבה (ללא תשלום)</Label>
      <Textarea
        id={`${idPrefix}-free-reason`}
        rows={2}
        placeholder="למשל: שבוע ניסיון, מלגה, פיצוי"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={300}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">לא מופקת קבלה. ההורה חותם על ההסכם ומקבל אישור בוואטסאפ.</p>
    </div>
  );
}

/** A free sale may be sent once its reason is long enough (the server checks the same). */
export const freeReasonReady = (reason: string) => reason.trim().length >= 2;
