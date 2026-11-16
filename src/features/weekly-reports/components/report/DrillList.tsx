import Link from "next/link";
import type { DrillCandidate } from "../../lib/fact-sheet/types";

interface DrillListProps {
  drills: readonly DrillCandidate[];
  /** Each name links to the drill's page in the book. Only for the signed-in player; the parent page has no login. */
  linkToBook?: boolean;
}

/**
 * The Development book drills chosen for the report, each with the book's
 * "למה" line. Renders nothing without a drill.
 */
export function DrillList({ drills, linkToBook = false }: DrillListProps) {
  if (drills.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">תרגילים מומלצים</h2>
      <ul className="space-y-2">
        {drills.map((drill) => (
          <li key={drill.id} className="rounded-xl border border-black/5 bg-paper p-3 text-sm">
            {linkToBook ? (
              <Link
                href={`/dashboard/book/drills/${drill.id}`}
                className="inline-flex min-h-10 items-center font-medium text-forest underline-offset-4 hover:underline"
              >
                {drill.name}
              </Link>
            ) : (
              <p className="font-medium">{drill.name}</p>
            )}
            {drill.why && <p className="mt-1 text-muted-foreground">למה: {drill.why}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
