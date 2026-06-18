"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clipboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseLeadsPaste } from "@/lib/utils/parse-leads-paste";
import { createLeadsBulk } from "@/lib/actions/admin-leads-bulk";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadTab,
  type LeadSource,
  type LeadStatus,
} from "@/types/leads";

interface PasteLeadsDialogProps {
  readonly tabs: readonly LeadTab[];
  readonly activeTabId: string;
}

export function PasteLeadsDialog({ tabs, activeTabId }: PasteLeadsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tabId, setTabId] = useState(activeTabId);
  const [source, setSource] = useState<LeadSource>("organic");
  const [status, setStatus] = useState<LeadStatus>("new");

  const parsed = useMemo(() => parseLeadsPaste(text), [text]);
  const validCount = parsed.valid.length;
  const errorCount = parsed.errors.length;

  const handleSubmit = async () => {
    if (validCount === 0) return;
    setSubmitting(true);
    const result = await createLeadsBulk(parsed.valid, {
      tab_id: tabId,
      source,
      status,
    });
    setSubmitting(false);

    if (result.inserted === 0 && result.skipped === 0) {
      toast.error(result.errors[0]?.message ?? "הייבוא נכשל");
      return;
    }

    if (result.inserted > 0) toast.success(`נוספו ${result.inserted} לידים`);
    if (result.skipped > 0) toast.warning(`${result.skipped} כפולים דולגו`);
    if (result.errors.length > 0) toast.warning(`${result.errors.length} שורות שגויות`);

    router.refresh();
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <Clipboard className="h-4 w-4 ml-2" />
          הדבקה מ-Sheets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>הדבקת לידים מגיליון</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            העתק מהגיליון כולל שורת כותרת. עמודות מזוהות לפי שם הכותרת בכל סדר:{" "}
            <code>שם</code> (חובה), <code>טלפון</code>, <code>הערה</code>,{" "}
            <code>מועדון</code>, <code>שנתון</code>, <code>חיפה</code>.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">טאב</Label>
              <Select value={tabId} onValueChange={setTabId} dir="rtl">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מקור</Label>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as LeadSource)}
                dir="rtl"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סטטוס</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as LeadStatus)}
                dir="rtl"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"שם\tטלפון\nדני כהן\t0541234567\nנועה לוי\t0509876543"}
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
                      {row.name} — <code>{row.phone ?? "ללא טלפון"}</code>
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
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                מייבא...
              </>
            ) : (
              `ייבא ${validCount}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
