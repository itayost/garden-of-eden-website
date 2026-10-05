"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSessionsAction,
  extendPlanAction,
  type AdminPlanRow,
} from "../../lib/actions/admin-plans";
import { CancelPlanDialog } from "./CancelPlanDialog";
import { EarlyEndDialog } from "./EarlyEndDialog";
import { VoidPlanDialog } from "./VoidPlanDialog";

export function PlanActionsDialog({ row, onClose }: { row: AdminPlanRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [endsOn, setEndsOn] = useState(row.shown.expiresOn);
  const [sessions, setSessions] = useState(1);
  const [voiding, setVoiding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [endingEarly, setEndingEarly] = useState(false);

  const run = (fn: () => Promise<{ success: true } | { error: string }>, done: string) => {
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      router.refresh();
      onClose();
    });
  };

  // Extend and add sessions only on a Plan still running.
  const live = row.plan.status === "active" && !row.plan.ended_on;

  if (voiding) return <VoidPlanDialog planId={row.plan.id} onClose={onClose} />;
  if (cancelling) return <CancelPlanDialog planId={row.plan.id} onClose={onClose} />;
  if (endingEarly) return <EarlyEndDialog planId={row.plan.id} onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {row.traineeName}: {row.product.name_he}
          </DialogTitle>
          <DialogDescription>הארכה, הוספת אימונים או ביטול המסלול</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {live && (
            <div className="space-y-2">
              <Label htmlFor="ends-on">תוקף עד</Label>
              <div className="flex gap-2">
                <Input
                  id="ends-on"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  disabled={pending}
                />
                <Button
                  onClick={() =>
                    run(() => extendPlanAction({ planId: row.plan.id, endsOn }), "התוקף עודכן")
                  }
                  disabled={pending}
                >
                  שמירה
                </Button>
              </div>
            </div>
          )}

          {live && row.plan.sessions_total !== null && (
            <div className="space-y-2">
              <Label htmlFor="sessions">הוספת אימונים</Label>
              <div className="flex gap-2">
                <Input
                  id="sessions"
                  type="number"
                  min={1}
                  max={50}
                  value={sessions}
                  onChange={(e) => setSessions(Number(e.target.value))}
                  disabled={pending}
                />
                <Button
                  onClick={() =>
                    run(
                      () => addSessionsAction({ planId: row.plan.id, sessions }),
                      "האימונים נוספו",
                    )
                  }
                  disabled={pending}
                >
                  הוספה
                </Button>
              </div>
            </div>
          )}

          {row.plan.status !== "voided" && !row.plan.ended_on && (
            <Button variant="outline" className="w-full" disabled={pending} onClick={() => setVoiding(true)}>
              ביטול רישום (נרשם בטעות)
            </Button>
          )}

          {/* The dialog asks the server whether it can end today, and says why not. */}
          {row.plan.status === "active" && !row.plan.ended_on && (
            <Button variant="outline" className="w-full" disabled={pending} onClick={() => setEndingEarly(true)}>
              סיום מוקדם (המסלול הבא יתחיל היום)
            </Button>
          )}

          {row.plan.status === "active" && !row.plan.ended_on && (
            <Button variant="destructive" className="w-full" disabled={pending} onClick={() => setCancelling(true)}>
              ביטול עסקה (לפי מדיניות הביטול)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
