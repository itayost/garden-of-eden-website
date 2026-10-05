"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { planAdjustment } from "@/lib/plans/adjustment";
import {
  adjustSessionsAction,
  getAdjustmentContextAction,
  type AdjustmentContext,
} from "../../lib/actions/adjust-sessions";
import { usePlanPreview } from "../../hooks/usePlanPreview";

/** Quick reasons; any other is typed. */
const QUICK_REASONS = ["אי-הגעה שנספרה", "התאמה ל-Arbox", "פיצוי", "טעות ברישום"] as const;

/**
 * Adjustment: type the balance the Card should show and see the effect
 * before saving. Used sessions never change; a balance below the Card's
 * future Bookings cancels the latest of them.
 */
export function AdjustSessionsDialog({ planId, onClose }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const { preview: ctx, loadError } = usePlanPreview<AdjustmentContext>(
    planId,
    () => getAdjustmentContextAction(planId),
    (result) => setTarget(String(result.total - result.used)),
  );

  const preview = ctx && target !== "" ? planAdjustment({ total: ctx.total, used: ctx.used, booked: ctx.booked }, Number(target)) : null;

  const save = () =>
    startTransition(async () => {
      if (!ctx) return;
      const result = await adjustSessionsAction({ planId, target: Number(target), expectedTotal: ctx.total, reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.cancelledCount > 0 ? `היתרה עודכנה. ${result.cancelledCount} אימונים בוטלו והמתאמן קיבל הודעה.` : "היתרה עודכנה");
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>תיקון יתרה{ctx ? `: ${ctx.planName}` : ""}</DialogTitle>
          <DialogDescription>כותבים כמה אימונים צריכים להישאר בכרטיסייה. אימונים שנוצלו לא משתנים.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !ctx ? (
          <Skeleton className="h-32 w-full" />
        ) : ctx.refusal ? (
          <p className="text-sm text-destructive">{ctx.refusal}</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="adjust-target">יתרה חדשה</Label>
              <Input
                id="adjust-target"
                type="number"
                inputMode="numeric"
                min={0}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={pending}
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border p-3 text-sm tabular-nums">
              <dt className="text-muted-foreground">נוצלו</dt>
              <dd>{ctx.used}</dd>
              <dt className="text-muted-foreground">יתרה לפני ואחרי</dt>
              <dd>
                {ctx.total - ctx.used} → {preview?.ok ? preview.leftAfter : "?"}
              </dd>
              <dt className="text-muted-foreground">סה״כ בכרטיסייה לפני ואחרי</dt>
              <dd>
                {ctx.total} → {preview?.ok ? preview.totalAfter : "?"}
              </dd>
              {ctx.booked > 0 && (
                <>
                  <dt className="text-muted-foreground">מתוכם רשום מראש</dt>
                  <dd>{ctx.booked}</dd>
                </>
              )}
            </dl>
            {preview && !preview.ok && <p className="text-sm text-destructive">{preview.error}</p>}
            {preview?.ok && preview.bookingsOver > 0 && (
              <p className="text-sm text-destructive">
                {preview.bookingsOver} מהאימונים הרשומים מראש (המאוחרים) לא ייכנסו ביתרה: הם יעברו למסלול הממתין אם יש בו מקום, ואחרת יבוטלו והמתאמן יקבל הודעה.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="adjust-reason">סיבה</Label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setReason(quick)}
                    aria-pressed={reason === quick}
                    className="rounded-full border px-3 py-1 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <Textarea id="adjust-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} disabled={pending} />
            </div>

            <Button className="w-full" onClick={save} disabled={pending || !preview?.ok || reason.trim().length < 2}>
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              שמירת היתרה
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
