"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseChurnedPaste } from "@/lib/utils/parse-churned-paste";
import { formatDateShort } from "@/lib/utils/date";
import {
  createChurnedCustomersBulk,
  type ChurnedCustomer,
} from "@/lib/actions/admin-churned-customers";

interface PasteChurnedDialogProps {
  readonly onInserted: (rows: readonly ChurnedCustomer[]) => void;
}

export function PasteChurnedDialog({ onInserted }: PasteChurnedDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseChurnedPaste(text), [text]);
  const validCount = parsed.valid.length;
  const errorCount = parsed.errors.length;

  const handleSubmit = async () => {
    if (validCount === 0) return;
    setSubmitting(true);
    const result = await createChurnedCustomersBulk(parsed.valid);
    setSubmitting(false);

    if (result.inserted.length === 0) {
      toast.error("השמירה נכשלה");
      return;
    }

    onInserted(result.inserted);
    toast.success(`נוספו ${result.inserted.length} רשומות`);
    if (result.errors.length > 0) {
      toast.warning(`${result.errors.length} שורות דולגו`);
    }
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <Clipboard className="h-4 w-4 me-2" />
          הדבק רשימה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>הדבקת רשימת לקוחות שעזבו</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            פורמט: <code>שם</code> טאב <code>תאריך</code>, שורה לכל לקוח.
            תאריך: <strong>יום/חודש/שנה</strong> (לדוגמה <code>01/04/2026</code> = 1 באפריל 2026).
            תומך גם ב-<code>2026-04-01</code> ו-<code>01.04.2026</code>.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"דני כהן\t01/04/2026\nנועה לוי\t15/03/2026"}
            dir="auto"
          />
          {text && (
            <div className="text-sm space-y-2">
              <p>
                <span className="text-green-700">{validCount} תקינות</span>
                {" · "}
                <span className="text-red-700">{errorCount} שגיאות</span>
              </p>
              {validCount > 0 && (
                <ul className="max-h-32 overflow-y-auto text-xs space-y-0.5 border rounded p-2">
                  {parsed.valid.slice(0, 50).map((row, i) => (
                    <li key={`ok-${i}`} className="text-green-800">
                      {row.name} — <code>{formatDateShort(row.endDate)}</code>
                    </li>
                  ))}
                  {parsed.valid.length > 50 && (
                    <li className="text-muted-foreground">
                      ועוד {parsed.valid.length - 50} שורות...
                    </li>
                  )}
                </ul>
              )}
              {errorCount > 0 && (
                <ul className="max-h-32 overflow-y-auto text-xs space-y-0.5 border rounded p-2">
                  {parsed.errors.map((err) => (
                    <li key={`${err.line}-${err.message}`} className="text-red-700">
                      שורה {err.line}: {err.message} — <code>{err.raw}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={validCount === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                מוסיף...
              </>
            ) : (
              `הוסף ${validCount}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
