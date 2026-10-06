"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reasonSchema } from "@/lib/validations/plans-admin";

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

/** A free sale may be sent once its reason passes the server's own rule. */
export const freeReasonReady = (reason: string) => reasonSchema.safeParse(reason).success;
