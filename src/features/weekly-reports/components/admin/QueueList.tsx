import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import { cn } from "@/lib/utils";
import type { QueueRow } from "../../lib/queries/queue";
import { queueHref, type QueueLocation } from "../../lib/queue-view";
import { reportWeekLabel } from "../../lib/report-week";
import { StatusChip } from "./StatusChip";

interface QueueListProps {
  rows: readonly QueueRow[];
  /** The week, branch and filter in view; a row adds ?report=. */
  location: QueueLocation & { week: string };
  selectedId: string | null;
  emptyText: string;
}

/** The second line of a row: why it stopped, else what was sent, else the start of the text. */
function RowLine({ row }: { row: QueueRow }) {
  if (row.status === "held" && row.holdReasons.length > 0) {
    return <p className="truncate text-xs font-semibold text-warning-emphasis">{row.holdReasons[0].text}</p>;
  }
  if (row.kind === "missed_you") return <p className="truncate text-xs text-muted-foreground">הודעת התגעגענו קבועה</p>;
  if (row.status === "sent") {
    return (
      <p className="truncate text-xs text-muted-foreground">
        {[row.parentOutcome, row.parentOpened ? "ההורה פתח" : null, row.playerOpened ? "השחקן קרא" : null]
          .filter((part) => part !== null)
          .join(" · ") || "נשלח"}
      </p>
    );
  }
  if (row.preview === null) return <p className="text-xs text-muted-foreground">הטקסט עוד לא נכתב</p>;
  return <p className="truncate text-xs text-muted-foreground">{row.preview}</p>;
}

/** "לא הגיעו 3 שבועות": the last training and the way to the trainee page; there is no report to open. */
function AbsentRow({ row, weekStart }: { row: QueueRow; weekStart: string }) {
  const last = row.lastTrainedOn
    ? `אימון אחרון ${shortDate(row.lastTrainedOn)}`
    : `אימון אחרון בשבוע ${reportWeekLabel(addDays(weekStart, -28))}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{row.fullName}</p>
        <p className="text-xs text-muted-foreground">{[row.branchNames.join(", "), last].filter((p) => p !== "").join(" · ")}</p>
      </div>
      <Link href={`/admin/users/${row.traineeId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ExternalLink className="size-4" aria-hidden="true" />
        לדף החניך
      </Link>
    </li>
  );
}

/** The rows of the filter in view. A row opens its report beside the list, or over it on a phone. */
export function QueueList({ rows, location, selectedId, emptyText }: QueueListProps) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {rows.map((row) =>
        row.kind === "absent" ? (
          <AbsentRow key={row.id} row={row} weekStart={location.week} />
        ) : (
          <li key={row.id}>
            <Link
              href={queueHref({ ...location, report: row.id })}
              replace
              scroll={false}
              aria-current={row.id === selectedId ? "true" : undefined}
              className={cn(
                "grid gap-0.5 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                row.id === selectedId && "bg-secondary hover:bg-secondary",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{row.fullName}</span>
                <StatusChip status={row.status} className="shrink-0" />
                {row.newData && <span className="shrink-0 text-[11px] font-medium text-info">נוספו נתונים</span>}
                {row.editRatio !== null && <span className="shrink-0 text-[11px] text-muted-foreground">נערך</span>}
              </span>
              <RowLine row={row} />
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
