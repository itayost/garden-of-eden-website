import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { PlanHistoryRow, PlanHistoryState } from "@/lib/plans/plan-history";
import type { StoredPlan } from "../lib/queries";

const STATE: Record<PlanHistoryState, { label: string; className: string }> = {
  current: { label: "פעיל", className: "bg-success text-success-foreground" },
  queued: { label: "ממתין", className: "bg-sky-100 text-sky-900" },
  ended: { label: "הסתיים", className: "bg-muted text-muted-foreground" },
  ended_early: { label: "הסתיים מוקדם", className: "bg-muted text-muted-foreground" },
  never_runs: { label: "לא יופעל", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "בוטל", className: "bg-muted text-muted-foreground line-through" },
  voided: { label: "רישום בוטל", className: "bg-muted text-muted-foreground line-through" },
  addon: { label: "תוספת", className: "bg-muted text-foreground" },
};

/**
 * Every Plan a Trainee holds, for staff: what runs now, what waits and from
 * when, and what came before. Read-only; actions live on the card.
 */
export function PlanHistoryList({
  rows,
  onVoid,
}: {
  rows: readonly PlanHistoryRow<StoredPlan>[];
  /** Admins and Branch managers: undo a Plan recorded by mistake. */
  onVoid?: (planId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y rounded-xl border text-sm">
      {rows.map((row) => {
        const state = STATE[row.state];
        return (
          <li key={row.plan.id} className="flex items-center gap-3 px-3 py-2">
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", state.className)}>{state.label}</span>
            <span className="min-w-0 flex-1 truncate">{row.plan.product?.name_he ?? "מסלול"}</span>
            {row.sessionsLeft !== null && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">נותרו {row.sessionsLeft}</span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {shortDate(row.startsOn)} עד {shortDate(row.endsOn)}
            </span>
            {onVoid && row.state !== "voided" && (
              <button
                type="button"
                onClick={() => onVoid(row.plan.id)}
                className="shrink-0 rounded-full px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
              >
                ביטול רישום
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
