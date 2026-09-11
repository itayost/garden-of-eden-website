"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/utils/iso-date";
import { getPlanForProfileAction, type AdminPlanRow } from "../../lib/actions/admin-plans";
import { PlanStatusBadge } from "../PlanStatusBadge";
import { StaffPaymentSheet } from "./StaffPaymentSheet";

interface PlanSheetProps {
  traineeId: string;
  traineeName: string;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Opened from a roster chip on the daily board: the plan at a glance and
 * one button to record a payment, without leaving the board.
 */
export function PlanSheet({ traineeId, traineeName, isAdmin, open, onOpenChange }: PlanSheetProps) {
  const [row, setRow] = useState<AdminPlanRow | null | undefined>(undefined);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPlanForProfileAction(traineeId).then((r) => {
      if (!cancelled) setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [open, traineeId]);

  return (
    <>
      <Dialog
        open={open && !payOpen}
        onOpenChange={(v) => {
          if (!v) setRow(undefined);
          onOpenChange(v);
        }}
      >
        <SheetDialogContent>
          <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {traineeName}
            </DialogTitle>
            <DialogDescription>{row ? row.product.name_he : row === null ? "אין מסלול פעיל" : "טוען..."}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 text-sm sm:px-6 sm:pb-6">
            {row === undefined ? (
              <Skeleton className="h-20 w-full" />
            ) : row ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">סטטוס</dt>
                <dd>
                  <PlanStatusBadge status={row.status} />
                </dd>
                {row.plan.sessions_total !== null && (
                  <>
                    <dt className="text-muted-foreground">אימונים</dt>
                    <dd>
                      {row.sessionsUsed} / {row.plan.sessions_total}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">תוקף</dt>
                <dd>
                  {shortDate(row.plan.starts_on)} עד {shortDate(row.plan.ends_on)}
                </dd>
                {row.guardianPhone && (
                  <>
                    <dt className="text-muted-foreground">הורה</dt>
                    <dd>
                      <a href={`tel:${row.guardianPhone}`} className="underline">
                        {row.guardianName ?? "הורה"}
                      </a>
                    </dd>
                  </>
                )}
              </dl>
            ) : null}
            <Button className="h-12 w-full rounded-full text-base" onClick={() => setPayOpen(true)} disabled={row === undefined}>
              <Banknote className="h-4 w-4 me-2" />
              רישום תשלום
            </Button>
          </div>
        </SheetDialogContent>
      </Dialog>
      <StaffPaymentSheet
        traineeId={traineeId}
        isAdmin={isAdmin}
        open={payOpen}
        onOpenChange={(v) => {
          setPayOpen(v);
          if (!v) onOpenChange(false);
        }}
      />
    </>
  );
}
