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
import { PlanStatusBadge } from "./PlanStatusBadge";
import { StaffPaymentSheet } from "./staff/StaffPaymentSheet";

interface UserPlanCardProps {
  /** Null when the trainee has no plan yet. */
  row: AdminPlanRow | null;
  isAdmin: boolean;
  traineeId: string;
}

/** The trainee's current plan for staff, with the payment entry point. */
export function UserPlanCard({ row, isAdmin, traineeId }: UserPlanCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
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
            {row.plan.sessions_total !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">אימונים</span>
                <span>
                  {row.sessionsUsed} / {row.plan.sessions_total}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">תוקף</span>
              <span>
                {shortDate(row.plan.starts_on)} עד {shortDate(row.plan.ends_on)}
              </span>
            </div>
            {row.orderDocumentUrl && (
              <a href={row.orderDocumentUrl} target="_blank" rel="noreferrer" className="block text-sm underline">
                חשבונית ב-Morning
              </a>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button className="flex-1" onClick={() => setPayOpen(true)}>
            <Banknote className="h-4 w-4 me-2" />
            {row ? "רישום תשלום / חידוש" : "רישום תשלום"}
          </Button>
          {isAdmin && row && (
            <Button variant="outline" onClick={() => setActionsOpen(true)}>
              פעולות
            </Button>
          )}
        </div>
        {actionsOpen && row && <PlanActionsDialog row={row} onClose={() => setActionsOpen(false)} />}
        <StaffPaymentSheet traineeId={traineeId} isAdmin={isAdmin} open={payOpen} onOpenChange={setPayOpen} />
      </CardContent>
    </Card>
  );
}
