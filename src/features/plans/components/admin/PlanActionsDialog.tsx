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
import { Textarea } from "@/components/ui/textarea";
import {
  extendPlanAction,
  type AdminPlanRow,
} from "../../lib/actions/admin-plans";
import { CancelPlanDialog } from "./CancelPlanDialog";
import { EarlyEndDialog } from "./EarlyEndDialog";
import { AdjustSessionsDialog } from "./AdjustSessionsDialog";
import { VoidPlanDialog } from "./VoidPlanDialog";

export function PlanActionsDialog({ row, onClose }: { row: AdminPlanRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [endsOn, setEndsOn] = useState(row.shown.expiresOn);
  const [extendReason, setExtendReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [endingEarly, setEndingEarly] = useState(false);

  const saveEndDate = () => {
    startTransition(async () => {
      const result = await extendPlanAction({
        planId: row.plan.id,
        endsOn,
        expectedEndsOn: row.plan.ends_on,
        reason: extendReason,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cancelledCount > 0
          ? `התוקף עודכן. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.`
          : "התוקף עודכן",
      );
      router.refresh();
      onClose();
    });
  };

  // A new end date and an Adjustment only on a Plan still running.
  const live = row.plan.status === "active" && !row.plan.ended_on;

  if (voiding) return <VoidPlanDialog planId={row.plan.id} onClose={onClose} />;
  if (adjusting) return <AdjustSessionsDialog planId={row.plan.id} onClose={onClose} />;
  if (cancelling) return <CancelPlanDialog planId={row.plan.id} onClose={onClose} />;
  if (endingEarly) return <EarlyEndDialog planId={row.plan.id} onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {row.traineeName}: {row.product.name_he}
          </DialogTitle>
          <DialogDescription>שינוי תוקף, תיקון יתרה או ביטול המסלול</DialogDescription>
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
                  onClick={saveEndDate}
                  disabled={pending || extendReason.trim().length < 2}
                >
                  שמירה
                </Button>
              </div>
              <Label htmlFor="extend-reason" className="sr-only">
                סיבה לשינוי התוקף
              </Label>
              <Textarea
                id="extend-reason"
                rows={2}
                placeholder="סיבה לשינוי התוקף"
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                maxLength={300}
                disabled={pending}
              />
            </div>
          )}

          {live && row.plan.sessions_total !== null && (
            <Button variant="outline" className="w-full" disabled={pending} onClick={() => setAdjusting(true)}>
              תיקון יתרה
            </Button>
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
