import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { audienceText, dayMonth } from "../../lib/format";
import type { SurveyListRow } from "../../lib/queries";
import { SurveyStateBadge } from "./SurveyStateBadge";

/** Columns that give way on a phone, so the rows stay readable without scrolling sideways. */
const WIDE_ONLY = "hidden md:table-cell";

/** A draft has no results yet, so it opens in the builder. */
function rowHref(row: SurveyListRow): string {
  return row.state === "draft" ? `/admin/surveys/${row.id}/edit` : `/admin/surveys/${row.id}`;
}

/** How many of the Trainees who saw the Survey answered it. The ratePct is the results page's own figure. */
function AnsweredCell({ row }: { row: SurveyListRow }) {
  if (row.state === "draft") {
    return <span className="text-muted-foreground">עוד לא נשלח</span>;
  }
  if (row.state === "scheduled") {
    return <span className="text-muted-foreground">ייפתח ב-{dayMonth(row.opensOn)}</span>;
  }
  if (row.seen === 0) {
    return <span className="text-muted-foreground">עוד אף אחד לא ראה</span>;
  }
  return (
    <div className="w-28 md:w-40">
      <div className="flex items-baseline gap-1.5">
        <span className="font-bold tabular-nums">{row.answered}</span>
        <span className="text-xs text-muted-foreground">
          מתוך {row.seen} שראו · {row.ratePct}%
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${row.ratePct}%` }} />
      </div>
    </div>
  );
}

function SurveyRow({ row }: { row: SurveyListRow }) {
  const audience = audienceText(row.branchNames, row.birthYears);
  return (
    <TableRow className="relative">
      <TableCell className="max-w-sm whitespace-normal md:min-w-48">
        {/* The link's ::after covers the whole row, so the row is the click target. */}
        <Link
          href={rowHref(row)}
          className="font-semibold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {row.title}
        </Link>
        {audience !== "" && <span className="block text-xs text-muted-foreground">{audience}</span>}
      </TableCell>
      <TableCell>
        <SurveyStateBadge state={row.state} />
      </TableCell>
      <TableCell>
        <AnsweredCell row={row} />
      </TableCell>
      <TableCell className={`${WIDE_ONLY} tabular-nums`}>{row.audience}</TableCell>
      <TableCell className={`${WIDE_ONLY} tabular-nums`}>
        {row.closesOn === null ? (
          <span className="text-muted-foreground">ללא</span>
        ) : (
          dayMonth(row.closesOn)
        )}
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        {row.writerName === "" ? <span className="text-muted-foreground">-</span> : row.writerName}
      </TableCell>
      <TableCell className="w-10">
        <ChevronLeft aria-hidden className="size-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

export function SurveyListTable({ rows }: { rows: readonly SurveyListRow[] }) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>סקר</TableHead>
            <TableHead>מצב</TableHead>
            <TableHead>ענו</TableHead>
            <TableHead className={WIDE_ONLY}>נשלח ל</TableHead>
            <TableHead className={WIDE_ONLY}>נסגר</TableHead>
            <TableHead className={WIDE_ONLY}>נכתב ע״י</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">פתיחה</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <SurveyRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
