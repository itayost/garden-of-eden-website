import { Clock } from "lucide-react";
import type { TabCounts } from "../../lib/queue-view";

const PARTS = [
  { tab: "held", label: "מעוכבים", color: "bg-warning" },
  { tab: "pending", label: "ממתינים", color: "bg-info" },
  { tab: "approved", label: "אושרו", color: "bg-success/60" },
  { tab: "sent", label: "נשלחו", color: "bg-success" },
] as const;

/**
 * Where the week stands at a glance: one bar split by status, its legend with
 * the counts, and when approved reports next go out.
 */
export function WeekStatus({ counts, nextSend }: { counts: TabCounts; nextSend: string }) {
  const total = PARTS.reduce((sum, part) => sum + counts[part.tab], 0);
  return (
    <section aria-label="מצב השבוע" className="space-y-2 rounded-xl border bg-card p-3">
      {total > 0 ? (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {PARTS.filter((part) => counts[part.tab] > 0).map((part) => (
            <span key={part.tab} className={part.color} style={{ width: `${(counts[part.tab] / total) * 100}%` }} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">אין דוחות בשבוע הזה</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {PARTS.map((part) => (
            <li key={part.tab} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-sm ${part.color}`} aria-hidden="true" />
              <span className="font-bold tabular-nums text-foreground">{counts[part.tab]}</span>
              {part.label}
            </li>
          ))}
        </ul>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Clock className="size-3.5" aria-hidden="true" />
          {nextSend}
        </p>
      </div>
    </section>
  );
}
