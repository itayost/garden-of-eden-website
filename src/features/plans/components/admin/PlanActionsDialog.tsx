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
import { formatDate } from "@/lib/utils/date";
import { israelToday } from "@/lib/utils/tasks";
import { endFreezeAction } from "../../lib/actions/freeze";
import { CancelPlanDialog } from "./CancelPlanDialog";
import { FreezeDialog } from "./FreezeDialog";
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
  const [freezing, setFreezing] = useState(false);
  const openFreeze = row.plan.freezes?.find((f) => f.endsOn === null) ?? null;
  const [thawOn, setThawOn] = useState(() => israelToday());

  const endFreeze = () => {
    if (!openFreeze?.id) return;
    const freezeId = openFreeze.id;
    startTransition(async () => {
      const result = await endFreezeAction({ freezeId, endsOn: thawOn });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cancelledCount > 0
          ? `ההקפאה הסתיימה. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.`
          : "ההקפאה הסתיימה והמסלול נדחה בימי ההקפאה",
      );
      router.refresh();
      onClose();
    });
  };

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

  if (freezing) return <FreezeDialog planId={row.plan.id} onClose={onClose} />;
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
          <DialogDescription>שינוי תוקף, תיקון יתרה, הקפאה או ביטול המסלול</DialogDescription>
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

          {live && openFreeze && (
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-sm">
                מוקפא מ-{formatDate(openFreeze.startsOn)}, בלי תאריך סיום
              </p>
              <Label htmlFor="thaw-on">ההקפאה מסתיימת ב-</Label>
              <div className="flex gap-2">
                <Input id="thaw-on" type="date" value={thawOn} onChange={(e) => setThawOn(e.target.value)} disabled={pending} />
                <Button onClick={endFreeze} disabled={pending || !thawOn}>
                  סיום ההקפאה
                </Button>
              </div>
            </div>
          )}

          {live && !openFreeze && (
            <Button variant="outline" className="w-full" disabled={pending} onClick={() => setFreezing(true)}>
              הקפאה רפואית
            </Button>
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
