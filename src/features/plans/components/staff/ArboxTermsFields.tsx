"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArboxTermsDraft } from "@/lib/plans/arbox-terms";

interface ArboxTermsFieldsProps {
  value: ArboxTermsDraft;
  onChange: (next: ArboxTermsDraft) => void;
  /** The product counts sessions; a subscription or term does not. */
  hasSessions: boolean;
  disabled?: boolean;
}

const FIELD = "h-12 rounded-xl text-base";

/**
 * What Arbox actually sold. The product pre-fills it; staff correct it to
 * match the Arbox record, since Arbox's cards need not match ours.
 */
export function ArboxTermsFields({ value, onChange, hasSessions, disabled }: ArboxTermsFieldsProps) {
  const set = (key: keyof ArboxTermsDraft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value });
  const endsBeforeStart = value.startsOn !== "" && value.endsOn !== "" && value.endsOn < value.startsOn;

  return (
    <fieldset className="space-y-3 rounded-xl border p-3">
      <legend className="px-1 text-sm font-medium">כמו ב-Arbox</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="arbox-starts">מתחיל</Label>
          <Input id="arbox-starts" type="date" value={value.startsOn} onChange={set("startsOn")} className={FIELD} disabled={disabled} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="arbox-ends">מסתיים</Label>
          <Input
            id="arbox-ends"
            type="date"
            value={value.endsOn}
            min={value.startsOn || undefined}
            onChange={set("endsOn")}
            className={FIELD}
            disabled={disabled}
            aria-invalid={endsBeforeStart}
            aria-describedby={endsBeforeStart ? "arbox-ends-error" : undefined}
            required
          />
        </div>
        {hasSessions && (
          <div className="space-y-1">
            <Label htmlFor="arbox-sessions">אימונים בכרטיסייה</Label>
            <Input
              id="arbox-sessions"
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={value.sessionsTotal}
              onChange={set("sessionsTotal")}
              className={FIELD}
              disabled={disabled}
              required
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="arbox-amount">שולם (₪)</Label>
          <Input
            id="arbox-amount"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            value={value.amountIls}
            onChange={set("amountIls")}
            className={FIELD}
            disabled={disabled}
            required
          />
        </div>
      </div>
      {endsBeforeStart && (
        <p id="arbox-ends-error" className="text-xs text-destructive">
          תאריך הסיום קודם לתאריך ההתחלה
        </p>
      )}
    </fieldset>
  );
}
