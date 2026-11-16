"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import type { QueueRow } from "../../lib/queries/queue";
import { queueHref, type QueueLocation } from "../../lib/queue-view";
import { reportWeekLabel } from "../../lib/report-week";
import { StatusChip } from "./StatusChip";

interface QueueTableProps {
  rows: readonly QueueRow[];
  /** The week, branch and tab in view; opening a row adds ?report=. */
  location: QueueLocation & { week: string };
  emptyText: string;
}

function RowNotes({ row }: { row: QueueRow }) {
  const firstHold = row.status === "held" ? row.holdReasons[0]?.text : undefined;
  const unwritten = row.kind === "report" && row.writtenAt === null && (row.status === "pending" || row.status === "held");
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <StatusChip status={row.status} />
      {firstHold && <span className="text-warning-emphasis">{firstHold}</span>}
      {unwritten && <span className="text-muted-foreground">עוד לא נכתב</span>}
      {row.newData && (
        <Badge variant="outline" className="border-info/40 text-info">
          נוספו נתונים
        </Badge>
      )}
      {row.editRatio !== null && <span className="text-muted-foreground">נערך</span>}
      {row.parentOutcome && <span className="text-muted-foreground">{row.parentOutcome}</span>}
      {row.parentOpened && (
        <Badge variant="outline" className="border-success/40 text-success">
          נפתח
        </Badge>
      )}
    </div>
  );
}

/** "לא הגיעו 3 שבועות": name, branches and the last training, with the way to the trainee page. */
function AbsentRow({ row, weekStart }: { row: QueueRow; weekStart: string }) {
  const lastWeek = reportWeekLabel(addDays(weekStart, -28));
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{row.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {[row.branchNames.join(", "), row.lastTrainedOn ? `אימון אחרון ${shortDate(row.lastTrainedOn)}` : `אימון אחרון בשבוע ${lastWeek}`]
            .filter((part) => part !== "")
            .join(" · ")}
        </p>
      </div>
      <Link
        href={`/admin/users/${row.traineeId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ExternalLink className="size-4" aria-hidden="true" />
        לדף החניך
      </Link>
    </li>
  );
}

/** The rows of the tab in view; a row opens its report in the sheet. */
export function QueueTable({ rows, location, emptyText }: QueueTableProps) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return <p className="py-12 text-center text-muted-foreground">{emptyText}</p>;

  function open(id: string) {
    setOpening(id);
    startTransition(() => router.replace(queueHref({ ...location, report: id }), { scroll: false }));
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) =>
        row.kind === "absent" ? (
          <AbsentRow key={row.id} row={row} weekStart={location.week} />
        ) : (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => open(row.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{row.fullName}</span>
                  {row.branchNames.length > 0 && (
                    <span className="text-xs text-muted-foreground">{row.branchNames.join(", ")}</span>
                  )}
                </div>
                <RowNotes row={row} />
              </div>
              {pending && opening === row.id ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="פותח" />
              ) : (
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
