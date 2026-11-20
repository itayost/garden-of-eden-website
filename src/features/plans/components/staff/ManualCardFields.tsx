"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_INVOICE_SUBJECT } from "@/lib/plans/invoice-subject";
import type { ManualCardDraft } from "@/lib/plans/manual-card";

type NumberField = Exclude<keyof ManualCardDraft, "subject">;

const FIELDS: readonly { key: NumberField; label: string; step: string; inputMode: "numeric" | "decimal" }[] = [
  { key: "sessions", label: "אימונים", step: "1", inputMode: "numeric" },
  { key: "price", label: "מחיר (₪)", step: "0.01", inputMode: "decimal" },
  { key: "days", label: "תוקף (ימים)", step: "1", inputMode: "numeric" },
];

/** A manual Card's terms, typed by an Admin or the branch's manager. */
export function ManualCardFields({
  value,
  onChange,
  problem,
  disabled,
}: {
  value: ManualCardDraft;
  onChange: (next: ManualCardDraft) => void;
  problem: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`manual-${field.key}`}>{field.label}</Label>
            <Input
              id={`manual-${field.key}`}
              type="number"
              inputMode={field.inputMode}
              min={0}
              step={field.step}
              className="h-12 rounded-xl text-base"
              value={value[field.key]}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="manual-subject">נושא לחשבונית (לא חובה)</Label>
        <Input
          id="manual-subject"
          type="text"
          enterKeyHint="done"
          maxLength={MAX_INVOICE_SUBJECT}
          placeholder="למשל: מחנה פסח"
          className="h-12 rounded-xl text-base"
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          disabled={disabled}
        />
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
      <p className="text-xs text-muted-foreground">
        הקבלה וההסכם יציגו את המחיר ואת התנאים שנקבעו כאן, והקבלה גם את הנושא.
      </p>
    </div>
  );
}
