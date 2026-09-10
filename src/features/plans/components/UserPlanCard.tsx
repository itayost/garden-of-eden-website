"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
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

export function UserPlanCard({ row, isAdmin }: { row: AdminPlanRow; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          מסלול
        </CardTitle>
        <CardDescription>{row.product.name_he}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
          <a
            href={row.orderDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm underline"
          >
            חשבונית ב-Morning
          </a>
        )}
        {isAdmin && (
          <>
            <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
              פעולות
            </Button>
            {open && <PlanActionsDialog row={row} onClose={() => setOpen(false)} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
