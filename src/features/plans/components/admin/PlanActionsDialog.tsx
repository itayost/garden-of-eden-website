"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  cancelPlanAction,
  extendPlanAction,
  type AdminPlanRow,
} from "../../lib/actions/admin-plans";

export function PlanActionsDialog({ row, onClose }: { row: AdminPlanRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [endsOn, setEndsOn] = useState(row.plan.ends_on);
  const [sessions, setSessions] = useState(1);

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

          {row.plan.sessions_total !== null && (
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

          {row.plan.status === "active" && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => cancelPlanAction({ planId: row.plan.id }), "המסלול בוטל")}
            >
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              ביטול המסלול
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
