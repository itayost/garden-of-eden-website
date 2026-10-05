"use client";

import { useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { shortDate } from "@/lib/utils/iso-date";
import type { AdminPlanRow } from "../lib/actions/admin-plans";
import { PlanActionsDialog } from "./admin/PlanActionsDialog";
import { AdjustSessionsDialog } from "./admin/AdjustSessionsDialog";
import { VoidPlanDialog } from "./admin/VoidPlanDialog";
import { PlanHistoryList } from "./PlanHistoryList";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { StaffPaymentSheet } from "./staff/StaffPaymentSheet";
import { AgreementBadge } from "./staff/AgreementBadge";

interface UserPlanCardProps {
  /** Null when the trainee has no plan yet. */
  row: AdminPlanRow | null;
  isAdmin: boolean;
  /** Admin, or Branch manager of the plan's branch: the plan actions. */
  canManage?: boolean;
  traineeId: string;
}

/** The trainee's current plan for staff, with the payment entry point. */
export function UserPlanCard({ row, isAdmin, canManage = isAdmin, traineeId }: UserPlanCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [voidFor, setVoidFor] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          מסלול
        </CardTitle>
        <CardDescription>{row ? row.product.name_he : "אין מסלול פעיל"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {row && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">סטטוס</span>
              <PlanStatusBadge status={row.status} />
            </div>
            {row.sessionsLeft !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">נותרו אימונים</span>
                <span>{row.sessionsLeft}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">תוקף</span>
              <span>
                {shortDate(row.shown.startsOn)} עד {shortDate(row.shown.endsOn)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">הסכם</span>
              <AgreementBadge agreementId={row.agreementId} signed={row.agreementSigned} />
            </div>
            {row.receivedByName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">נרשם ע&quot;י</span>
                <span>{row.receivedByName}</span>
              </div>
            )}
            {row.orderDocumentUrl && (
              <a href={row.orderDocumentUrl} target="_blank" rel="noreferrer" className="block text-sm underline">
                חשבונית ב-Morning
              </a>
            )}
            {row.history && row.history.length > 1 && (
              <div className="space-y-2 pt-2">
                <span className="text-muted-foreground">כל המסלולים</span>
                <PlanHistoryList
                  rows={row.history}
                  onVoid={canManage ? setVoidFor : undefined}
                  onAdjust={canManage ? setAdjustFor : undefined}
                />
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button className="flex-1" onClick={() => setPayOpen(true)}>
            <Banknote className="h-4 w-4 me-2" />
            {row ? "רישום תשלום / חידוש" : "רישום תשלום"}
          </Button>
          {canManage && row && (
            <Button variant="outline" onClick={() => setActionsOpen(true)}>
              פעולות
            </Button>
          )}
        </div>
        {actionsOpen && row && <PlanActionsDialog row={row} onClose={() => setActionsOpen(false)} />}
        {voidFor && <VoidPlanDialog key={voidFor} planId={voidFor} onClose={() => setVoidFor(null)} />}
        {adjustFor && <AdjustSessionsDialog key={adjustFor} planId={adjustFor} onClose={() => setAdjustFor(null)} />}
        <StaffPaymentSheet traineeId={traineeId} isAdmin={isAdmin} open={payOpen} onOpenChange={setPayOpen} />
      </CardContent>
    </Card>
  );
}
