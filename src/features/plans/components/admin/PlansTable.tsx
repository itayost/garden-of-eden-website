"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, MoreHorizontal } from "lucide-react";
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

export function PlansTable({ rows }: { rows: AdminPlanRow[] }) {
  const [target, setTarget] = useState<AdminPlanRow | null>(null);

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
              <TableHead className="w-[80px]"></TableHead>
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
                      {row.guardianPhone ? ` · ${row.guardianPhone}` : ""}
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
                    ? `ידני${row.plan.note ? ` (${row.plan.note})` : ""}`
                    : "אונליין"}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTarget(row)}
                    aria-label="פעולות"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {target && (
        <PlanActionsDialog key={target.plan.id} row={target} onClose={() => setTarget(null)} />
      )}
    </>
  );
}
