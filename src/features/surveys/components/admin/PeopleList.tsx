import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PersonRow } from "../../lib/report";
import { displayName, israelDayMonth } from "../../lib/results-view";
import { PersonBlock } from "./PersonBlock";

interface PeopleListProps {
  rows: readonly PersonRow[];
  /** "ראו ולא ענו" says when each first saw the Survey; "לא ראו" has no date to give. */
  showSeenDate: boolean;
}

function PersonItem({ row, showSeenDate }: { row: PersonRow; showSeenDate: boolean }) {
  const seenAt = showSeenDate ? row.firstSeenAt : null;
  return (
    <li className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
      <Link
        href={`/admin/users/${row.profileId}`}
        className="min-w-0 text-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
      >
        <PersonBlock
          fullName={row.fullName}
          branchNames={row.branchNames}
          birthYear={row.birthYear}
          muted={!showSeenDate}
        />
        <span className="sr-only">, לדף החניך של {displayName(row.fullName)}</span>
      </Link>
      {seenAt !== null && (
        <span className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          ראה ב-{israelDayMonth(seenAt)}
        </span>
      )}
      <ExternalLink
        aria-hidden="true"
        className={cn("size-4 shrink-0 text-muted-foreground", seenAt === null && "ms-auto")}
      />
    </li>
  );
}

/**
 * The Trainees of the two lists without answers, so staff can remind them in
 * person. A row is a link to the Trainee's staff page.
 */
export function PeopleList({ rows, showSeenDate }: PeopleListProps) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <PersonItem key={row.profileId} row={row} showSeenDate={showSeenDate} />
      ))}
    </ul>
  );
}
