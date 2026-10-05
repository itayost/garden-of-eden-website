"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/date";
import { israelToday } from "@/lib/utils/tasks";
import { freezePlanAction, previewFreezeAction, type FreezePreview } from "../../lib/actions/freeze";
import { usePlanPreview } from "../../hooks/usePlanPreview";
import { AffectedBookings } from "./RefundParts";

/**
 * Freeze: a medical stretch when the Plan does not run. Its end, and the
 * Plans queued behind it, move by the frozen days. Never for a vacation.
 */
export function FreezeDialog({ planId, onClose }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [startsOn, setStartsOn] = useState(() => israelToday());
  const [openEnded, setOpenEnded] = useState(false);
  const [endsOn, setEndsOn] = useState("");
  const [certificate, setCertificate] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  // A closed Freeze is previewed once both dates are in.
  const end = openEnded ? null : endsOn || null;
  const ready = Boolean(startsOn) && (openEnded || Boolean(endsOn));
  const { preview, loadError } = usePlanPreview<FreezePreview>(`${planId}:${startsOn}:${end ?? "open"}:${ready}`, () =>
    previewFreezeAction(planId, startsOn, ready ? end : null),
  );

  const confirm = () =>
    startTransition(async () => {
      const result = await freezePlanAction({ planId, startsOn, endsOn: end, medicalCertificate: certificate, reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.incomplete) {
        toast.error("המסלול הוקפא, אך חלק מהאימונים לא בוטלו. בדקו את לוח השיבוץ של המתאמן.");
      } else {
        toast.success(
          result.cancelledCount > 0 ? `המסלול הוקפא. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.` : "המסלול הוקפא",
        );
      }
      router.refresh();
      onClose();
    });

  const canSave = ready && certificate && reason.trim().length >= 2 && preview !== null && !preview.refusal;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>הקפאה רפואית{preview ? `: ${preview.planName}` : ""}</DialogTitle>
          <DialogDescription>
            רק באישור רפואי, לא לחופשה. בימי ההקפאה אין אימונים, והמסלול והמסלולים שאחריו נדחים באותו מספר ימים.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="freeze-start">מתאריך</Label>
              <Input
                id="freeze-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="freeze-end">עד תאריך</Label>
              <Input
                id="freeze-end"
                type="date"
                value={openEnded ? "" : endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                disabled={pending || openEnded}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="freeze-open" checked={openEnded} onCheckedChange={(v) => setOpenEnded(v === true)} disabled={pending} />
            <Label htmlFor="freeze-open" className="font-normal">
              בלי תאריך סיום (מסיימים כשהמתאמן חוזר)
            </Label>
          </div>

          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !preview ? (
            <Skeleton className="h-16 w-full" />
          ) : preview.refusal ? (
            ready && <p className="text-sm text-destructive">{preview.refusal}</p>
          ) : (
            ready && (
              <>
                <p className="text-sm">
                  סיום המסלול: {formatDate(preview.endsOn)} ← <span className="font-bold">{formatDate(preview.endsOnAfter)}</span>
                  {openEnded && " (נכון להיום; ימשיך לזוז עד סיום ההקפאה)"}
                </p>
                <AffectedBookings moved={preview.moved} cancelled={preview.cancelled} />
              </>
            )
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="freeze-certificate"
              checked={certificate}
              onCheckedChange={(v) => setCertificate(v === true)}
              disabled={pending}
            />
            <Label htmlFor="freeze-certificate" className="font-normal">
              התקבל אישור רפואי
            </Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="freeze-reason">סיבה</Label>
            <Textarea
              id="freeze-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="למשל: שבר ברגל, אישור רופא עד סוף החודש"
              maxLength={300}
              disabled={pending}
            />
          </div>
          <Button className="w-full" onClick={confirm} disabled={pending || !canSave}>
            {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            הקפאת המסלול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
