import type { DrillCandidate } from "../../lib/fact-sheet/types";

/**
 * The Development book drills chosen for the report, each with the book's
 * "למה" line. Renders nothing without a drill (always, until drills come in a
 * later step).
 */
export function DrillList({ drills }: { drills: readonly DrillCandidate[] }) {
  if (drills.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">תרגילים מומלצים</h2>
      <ul className="space-y-2">
        {drills.map((drill) => (
          <li key={drill.id} className="rounded-xl border border-black/5 bg-paper p-3 text-sm">
            <p className="font-medium">{drill.name}</p>
            {drill.why && <p className="mt-1 text-muted-foreground">למה: {drill.why}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
