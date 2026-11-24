"use client";

import { useState } from "react";
import { Loader2, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASON_MAX = 200;

interface HoldDialogProps {
  disabled: boolean;
  /** Holds the report with the reason; true when it was held. */
  onHold: (reason: string) => Promise<boolean>;
  variant?: "outline" | "ghost";
}

/** עכב: asks why, so whoever opens the report next knows what to check. */
export function HoldDialog({ disabled, onHold, variant = "outline" }: HoldDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = reason.trim().length < 2;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort) return;
    setBusy(true);
    try {
      if (await onHold(reason.trim())) {
        setOpen(false);
        setReason("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} disabled={disabled}>
          <PauseCircle aria-hidden="true" />
          עכב
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>לעכב את הדוח?</DialogTitle>
            <DialogDescription>הדוח לא יישלח עד שמישהו מהצוות יאשר אותו. מה צריך לבדוק?</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="hold-reason">סיבה</Label>
            <Textarea
              id="hold-reason"
              value={reason}
              maxLength={REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="למשל: לבדוק עם המאמן מה היה ביום שלישי"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || tooShort}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              עכב
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
