"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goalRefusal } from "@/features/goals/lib/utils/goal-rules";
import type { ProposalView } from "../lib/proposal-view";

interface ChangeTargetDialogProps {
  proposal: Pick<ProposalView, "id" | "metricKey" | "label" | "unit" | "lowerIsBetter" | "baseline" | "target">;
  disabled: boolean;
  /** Accepts the proposal at this target; true when the Goal was set. */
  onChange: (target: number) => Promise<boolean>;
}

/** A number as typed, with a comma read as the point. NaN when it is not one. */
function parseTarget(value: string): number {
  const text = value.trim().replace(",", ".");
  return text === "" ? Number.NaN : Number(text);
}

/**
 * שנה יעד: the proposal accepted at a target staff type. The goal rules run
 * here before anything is sent (the same `goalRefusal` the server runs), so a
 * target on the wrong side of the baseline is refused with the rule's text.
 */
export function ChangeTargetDialog({ proposal, disabled, onChange }: ChangeTargetDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(proposal.target));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = `proposal-target-${proposal.id}`;

  function openChange(next: boolean) {
    if (busy) return;
    if (next) {
      setValue(String(proposal.target));
      setProblem(null);
    }
    setOpen(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const target = parseTarget(value);
    const refusal = goalRefusal({ metricKey: proposal.metricKey, targetValue: target, baselineValue: proposal.baseline });
    setProblem(refusal);
    if (refusal) return;
    setBusy(true);
    try {
      if (await onChange(target)) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <Pencil aria-hidden="true" />
          שנה יעד
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>שינוי יעד: {proposal.label}</DialogTitle>
            <DialogDescription>היעד יישמר במקום היעד שהוצע.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>יעד ({proposal.unit})</Label>
            <Input
              id={fieldId}
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="text-end tabular-nums"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={problem !== null}
              aria-describedby={`${fieldId}-hint`}
            />
            <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
              כרגע: {proposal.baseline} {proposal.unit} · {proposal.lowerIsBetter ? "נמוך יותר טוב יותר" : "גבוה יותר טוב יותר"}
            </p>
            {problem && (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              קבע יעד
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
