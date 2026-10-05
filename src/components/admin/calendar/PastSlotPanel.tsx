"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callOffSlotAction, clearCalledOffAction } from "@/lib/actions/daily-schedule-called-off";
import type { ScheduleSlot } from "@/types/schedule";

interface PastSlotPanelProps {
  slot: ScheduleSlot;
  /** The Slot's start has passed: only then can it be Called off. */
  started: boolean;
  /** Admin, or Branch manager of the Slot's branch. */
  canManage: boolean;
}

/**
 * What staff fix on an hour that already happened: the academy calling it
 * off (nobody on its Roster is charged), and the names removed from it, kept
 * on record with who and why.
 */
export function PastSlotPanel({ slot, started, canManage }: PastSlotPanelProps) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const removed = slot.trainees.filter((t) => t.removed_at);

  const run = (fn: () => Promise<{ success: true } | { error: string }>, done: string) =>
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      setMarking(false);
      setReason("");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {slot.called_off_at ? (
        <div role="status" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-destructive">
            <Ban className="h-4 w-4" aria-hidden="true" />
            בוטל ע״י האקדמיה: אף אחד ברשימה לא מחויב באימון
          </p>
          <p className="text-muted-foreground">
            {slot.called_off_reason}
            {slot.called_off_by_name ? ` · ${slot.called_off_by_name}` : ""}
          </p>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => clearCalledOffAction({ slotId: slot.id }), "הסימון בוטל")}
            >
              ביטול הסימון
            </Button>
          )}
        </div>
      ) : (
        started &&
        canManage &&
        (marking ? (
          <div className="space-y-2 rounded-xl border p-3">
            <Label htmlFor="call-off-reason">למה האימון לא התקיים</Label>
            <Textarea
              id="call-off-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="למשל: גשם, המגרש לא היה זמין, אין מאמן"
              maxLength={300}
              disabled={pending}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || reason.trim().length < 2}
                onClick={() => run(() => callOffSlotAction({ slotId: slot.id, reason }), "האימון סומן כבוטל, והאימונים הוחזרו")}
              >
                {pending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : null}
                סימון כבוטל
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMarking(false)}>
                חזרה
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setMarking(true)}>
            <Ban className="h-4 w-4 me-2" />
            סימון כבוטל ע״י האקדמיה
          </Button>
        ))
      )}

      {removed.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">הוסרו מהאימון (לא נחשבים כאימון שנוצל)</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {removed.map((entry) => (
              <li key={entry.id}>
                <span className="line-through">{entry.trainee_name}</span>
                {` · ${entry.removed_reason ?? ""}`}
                {entry.removed_by_name ? ` · ${entry.removed_by_name}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
