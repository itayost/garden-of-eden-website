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

    if (result.inserted.length > 0) {
      onInserted(result.inserted);
      toast.success(`נוספו ${result.inserted.length} רשומות`);
    }
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} שגיאות בשמירה`);
    }
    if (result.inserted.length > 0) {
      setText("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <Clipboard className="h-4 w-4 me-2" />
          הדבק רשימה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>הדבקת רשימת לקוחות שעזבו</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={`הדבק שורות בפורמט: שם[Tab]תאריך\nתאריכים נתמכים: dd/mm/yyyy, yyyy-mm-dd, dd.mm.yyyy`}
            dir="auto"
          />
          {text && (
            <div className="text-sm space-y-1">
              <p>
                <span className="text-green-700">{validCount} תקינות</span>
                {" · "}
                <span className="text-red-700">{errorCount} שגיאות</span>
              </p>
              {errorCount > 0 && (
                <ul className="max-h-40 overflow-y-auto text-xs space-y-0.5 border rounded p-2">
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
