import { cn } from "@/lib/utils";
import type { SurveyReport } from "../../lib/report";
import { percentOf, segmentCounts } from "../../lib/results-view";

interface SummaryStripProps {
  totals: SurveyReport["totals"];
  byBranch: SurveyReport["byBranch"];
}

function LegendItem({ swatch, label, count }: { swatch: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-[9px] rounded-[2px]", swatch)} />
      {label} <b className="font-semibold text-foreground">{count}</b>
    </span>
  );
}

/**
 * Who answered, at a glance: the answered number large, a bar of answered, saw
 * and did not answer, and never saw out of the Audience, and answered out of
 * seen per branch. On a phone it is a card with the number, its line and the bar.
 */
export function SummaryStrip({ totals, byBranch }: SummaryStripProps) {
  const counts = segmentCounts(totals);
  return (
    <section
      aria-label="סיכום התשובות"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card p-3.5 md:px-[18px]"
    >
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <b className="text-3xl font-extrabold leading-none tabular-nums">{totals.answered}</b>
        <span className="text-sm text-muted-foreground">
          ענו · {totals.ratePct}% מ-{totals.seen} שראו
          <span className="md:hidden"> · נשלח ל-{totals.audience}</span>
        </span>
      </p>

      <div className="w-full min-w-[260px] md:w-auto md:flex-1">
        <div
          role="img"
          aria-label={`מתוך ${totals.audience} חניכים: ענו ${counts.answered}, ראו ולא ענו ${counts.seen}, לא ראו ${counts.unseen}`}
          className="flex h-3 overflow-hidden rounded-full bg-muted"
        >
          <span className="h-full bg-primary" style={{ inlineSize: `${percentOf(counts.answered, totals.audience)}%` }} />
          <span className="h-full bg-warning/70" style={{ inlineSize: `${percentOf(counts.seen, totals.audience)}%` }} />
        </div>
        <p className="mt-2 hidden gap-4 text-[13px] tabular-nums text-muted-foreground md:flex">
          <LegendItem swatch="bg-primary" label="ענו" count={counts.answered} />
          <LegendItem swatch="bg-warning/70" label="ראו ולא ענו" count={counts.seen} />
          <LegendItem swatch="bg-muted ring-1 ring-inset ring-border" label="לא ראו" count={counts.unseen} />
        </p>
      </div>

      {byBranch.length > 0 && (
        <ul className="hidden gap-3.5 text-[13px] tabular-nums text-muted-foreground md:flex">
          {byBranch.map((branch) => (
            <li key={branch.branchId}>
              {branch.name}{" "}
              <b className="font-semibold text-foreground">
                {branch.answered}/{branch.seen}
              </b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
