"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ddmmyyyy } from "@/lib/plans/confirmation-copy";
import type { RefundMethod } from "@/lib/validations/plans-admin";
import type { AffectedBooking } from "../../lib/plan-context";
import { recordCreditNoteAction } from "../../lib/actions/void-plan";

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  card: "זיכוי כרטיס ב-Pelecard",
  cash: "מזומן",
  transfer: "העברה בנקאית",
  bit: "ביט",
  arbox: "הוחזר ב-Arbox",
  none: "לא הוחזר כסף",
};

/** The Bookings a change moves to the next Plan or cancels, for the confirmation. */
export function AffectedBookings({ moved, cancelled }: { moved: AffectedBooking[]; cancelled: AffectedBooking[] }) {
  return (
    <>
      <BookingList title="אימונים שיעברו למסלול הבא בתור" items={moved} tone="moved" />
      <BookingList title="אימונים שיבוטלו (המתאמן יקבל הודעה)" items={cancelled} tone="cancelled" />
    </>
  );
}

function BookingList({ title, items, tone }: { title: string; items: AffectedBooking[]; tone: "moved" | "cancelled" }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <ul className={tone === "cancelled" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {items.map((b) => (
          <li key={`${b.date} ${b.time}`}>
            {ddmmyyyy(b.date)} בשעה {b.time}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How the money went back. */
export function RefundMethodSelect({
  value,
  onChange,
  disabled,
}: {
  value: RefundMethod;
  onChange: (method: RefundMethod) => void;
  disabled: boolean;
}) {
  return (
    <select
      id="refund-method"
      value={value}
      onChange={(e) => onChange(e.target.value as RefundMethod)}
      disabled={disabled}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      {(Object.keys(REFUND_METHOD_LABELS) as RefundMethod[]).map((m) => (
        <option key={m} value={m}>
          {REFUND_METHOD_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

/**
 * After a Void or Cancellation: point to the original receipt in Morning,
 * where staff issue the credit invoice and negative receipt by hand, and
 * record the credit note number here.
 */
export function CreditNoteStep({
  refundId,
  receiptUrl,
  onDone,
}: {
  refundId: string;
  receiptUrl: string | null;
  onDone: () => void;
}) {
  const [number, setNumber] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await recordCreditNoteAction({ refundId, creditNoteNumber: number });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("מספר הזיכוי נשמר");
      onDone();
    });

  return (
    <div className="space-y-4 text-sm">
      <p>נשמר רישום ההחזר.</p>
      {receiptUrl ? (
        <>
          <p>עכשיו מפיקים ב-Morning חשבונית זיכוי וקבלה שלילית לקבלה המקורית, ורושמים כאן את מספר חשבונית הזיכוי.</p>
          <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            <ExternalLink className="h-4 w-4" />
            הקבלה המקורית ב-Morning
          </a>
          <div className="flex gap-2">
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="מספר חשבונית הזיכוי"
              aria-label="מספר חשבונית הזיכוי"
              disabled={pending}
            />
            <Button onClick={save} disabled={pending || number.trim() === ""}>
              שמירה
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">להזמנה אין קבלה ב-Morning, ולכן אין מה לזכות שם.</p>
      )}
      <Button variant="outline" className="w-full" onClick={onDone}>
        סגירה
      </Button>
    </div>
  );
}
