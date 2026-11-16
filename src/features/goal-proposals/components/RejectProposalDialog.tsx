"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
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

interface RejectProposalDialogProps {
  proposalId: string;
  label: string;
  disabled: boolean;
  /** Rejects the proposal with the reason (may be empty); true when it was rejected. */
  onReject: (reason: string) => Promise<boolean>;
}

/** דחה: an optional reason, so whoever looks at the proposals later knows why. */
export function RejectProposalDialog({ proposalId, label, disabled, onReject }: RejectProposalDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldId = `proposal-reject-${proposalId}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (await onReject(reason.trim())) {
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
        <Button type="button" size="sm" variant="ghost" disabled={disabled}>
          <X aria-hidden="true" />
          דחה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>לדחות את ההצעה: {label}?</DialogTitle>
            <DialogDescription>המדד לא יוצע שוב ב-60 הימים הקרובים.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>סיבה (לא חובה)</Label>
            <Textarea
              id={fieldId}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="למשל: כבר עובדים על זה באימונים"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              דחה הצעה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
