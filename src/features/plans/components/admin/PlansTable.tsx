"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, FileText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortDate } from "@/lib/utils/iso-date";
import type { AdminPlanRow } from "../../lib/actions/admin-plans";
import { PlanStatusBadge } from "../PlanStatusBadge";
import { PlanActionsDialog } from "./PlanActionsDialog";
import { StaffPaymentSheet } from "../staff/StaffPaymentSheet";
import { AgreementBadge } from "../staff/AgreementBadge";
import { formatPhoneToLocal } from "@/lib/validations/common";

export function PlansTable({ rows, isAdmin }: { rows: AdminPlanRow[]; isAdmin: boolean }) {
  const [target, setTarget] = useState<AdminPlanRow | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">אין מסלולים להצגה</p>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">חניך</TableHead>
              <TableHead className="text-right">מסלול</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">אימונים</TableHead>
              <TableHead className="text-right">תוקף</TableHead>
              <TableHead className="text-right">מקור</TableHead>
              <TableHead className="w-[140px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.plan.id}>
                <TableCell>
                  <Link
                    href={`/admin/users/${row.plan.profile_id}`}
                    className="font-medium hover:underline"
                  >
                    {row.traineeName}
                  </Link>
                  {row.guardianName && (
                    <div className="text-xs text-muted-foreground">
                      {row.guardianName}
                      {row.guardianPhone ? (
                        <>
                          {" · "}
                          <a href={`tel:${row.guardianPhone}`} className="underline" dir="ltr">
                            {formatPhoneToLocal(row.guardianPhone)}
                          </a>
                        </>
                      ) : ""}
                    </div>
                  )}
                </TableCell>
                <TableCell>{row.product.name_he}</TableCell>
                <TableCell>
                  <PlanStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.plan.sessions_total === null
                    ? "לפי זמן"
                    : `${row.sessionsUsed} / ${row.plan.sessions_total}`}
                </TableCell>
                <TableCell>
                  {shortDate(row.plan.starts_on)} עד {shortDate(row.plan.ends_on)}
                </TableCell>
                <TableCell>
                  {row.plan.source === "manual"
                    ? `ידני${row.plan.note ? ` (${row.plan.note})` : ""}${row.receivedByName ? ` · ${row.receivedByName}` : ""}`
                    : "אונליין"}
                  <div className="mt-1">
                    <AgreementBadge agreementId={row.agreementId} signed={row.agreementSigned} />
                  </div>
                  {row.orderDocumentUrl && (
                    <a
                      href={row.orderDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ms-2 inline-flex align-middle"
                      aria-label="חשבונית"
                    >
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPayFor(row.plan.profile_id)}
                    >
                      <Banknote className="h-4 w-4 me-1" />
                      תשלום
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTarget(row)}
                        aria-label="פעולות"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {target && (
        <PlanActionsDialog key={target.plan.id} row={target} onClose={() => setTarget(null)} />
      )}
      {payFor && (
        <StaffPaymentSheet
          key={payFor}
          traineeId={payFor}
          isAdmin={isAdmin}
          open
          onOpenChange={(open) => !open && setPayFor(null)}
        />
      )}
    </>
  );
}
