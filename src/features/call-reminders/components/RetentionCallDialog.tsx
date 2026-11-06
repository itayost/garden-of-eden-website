"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/utils/date";
import { LEAD_OUTCOME_LABELS, type LeadContactOutcome } from "@/types/leads";
import {
  addRetentionCallLogAction,
  getRetentionCallLogAction,
  type RetentionCallEntry,
} from "../lib/actions/retention-call-log";
import { CALL_EVENTS, emitCallEvent } from "../lib/events";

const NOTES_MAX = 2000;

const OUTCOME_OPTIONS = Object.entries(LEAD_OUTCOME_LABELS) as [LeadContactOutcome, string][];

interface RetentionCallDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly reportMonth: string;
  readonly phone: string;
  readonly traineeName: string;
  readonly onSaved?: () => void;
}

type History =
  | { readonly state: "loading" }
  | { readonly state: "error"; readonly message: string }
  | { readonly state: "ready"; readonly entries: readonly RetentionCallEntry[] };

/** Documents a retention call; the entry is what closes a call reminder. */
export function RetentionCallDialog({
  open,
  onOpenChange,
  reportMonth,
  phone,
  traineeName,
  onSaved,
}: RetentionCallDialogProps) {
  const [outcome, setOutcome] = useState<LeadContactOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<History>({ state: "loading" });

  const loadHistory = useCallback(async () => {
    setHistory({ state: "loading" });
    try {
      const result = await getRetentionCallLogAction(phone);
      setHistory(
        "error" in result
          ? { state: "error", message: result.error }
          : { state: "ready", entries: result.data },
      );
    } catch {
      setHistory({ state: "error", message: "שגיאה בטעינת היסטוריית השיחות" });
    }
  }, [phone]);

  useEffect(() => {
    if (open) void loadHistory();
  }, [open, loadHistory]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!outcome) {
      setOutcomeError("יש לבחור תוצאה");
      return;
    }
    setSaving(true);
    try {
      const result = await addRetentionCallLogAction({
        reportMonth,
        phone,
        traineeName,
        outcome,
        notes,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("השיחה תועדה");
      setOutcome("");
      setNotes("");
      emitCallEvent(CALL_EVENTS.documented);
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error("שגיאה בשמירת תיעוד השיחה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>תיעוד שיחה</DialogTitle>
          <DialogDescription>{traineeName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="retention-call-outcome">תוצאה *</Label>
            <Select
              value={outcome}
              onValueChange={(v) => {
                setOutcome(v as LeadContactOutcome);
                setOutcomeError(null);
              }}
            >
              <SelectTrigger
                id="retention-call-outcome"
                aria-invalid={outcomeError ? true : undefined}
                aria-describedby={outcomeError ? "retention-call-outcome-error" : undefined}
              >
                <SelectValue placeholder="בחר תוצאה" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {outcomeError && (
              <p id="retention-call-outcome-error" className="text-xs text-destructive">
                {outcomeError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retention-call-notes">הערות</Label>
            <Textarea
              id="retention-call-notes"
              rows={3}
              maxLength={NOTES_MAX}
              placeholder="מה עלה בשיחה..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />}
            שמירת התיעוד
          </Button>
        </form>

        <section aria-labelledby="retention-call-history" className="space-y-2 border-t pt-4">
          <h3 id="retention-call-history" className="text-sm font-medium">
            שיחות קודמות
          </h3>
          <CallHistory history={history} />
        </section>
      </DialogContent>
    </Dialog>
  );
}

function CallHistory({ history }: { readonly history: History }) {
  if (history.state === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        טוען...
      </p>
    );
  }
  if (history.state === "error") {
    return <p className="text-sm text-destructive">{history.message}</p>;
  }
  if (history.entries.length === 0) {
    return <p className="text-sm text-muted-foreground">עוד לא תועדו שיחות</p>;
  }
  return (
    <ol className="max-h-56 space-y-2 overflow-y-auto">
      {history.entries.map((entry) => (
        <li key={entry.id} className="rounded-md bg-muted/40 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{LEAD_OUTCOME_LABELS[entry.outcome]}</span>
            <span className="text-xs text-muted-foreground">
              {entry.authorName ?? "לא ידוע"} · {formatRelativeTime(entry.createdAt)}
            </span>
          </div>
          {entry.notes && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.notes}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
