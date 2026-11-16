import { CalendarClock } from "lucide-react";
import type { ParentPlan, ParentView } from "../../lib/queries/parent-view";
import { planBoxLines } from "../../lib/report-view";
import { reportWeekLabel } from "../../lib/report-week";
import { BodyBlock } from "./BodyBlock";
import { DrillList } from "./DrillList";
import { GoalProgressList } from "./GoalProgressList";

const PANEL = "rounded-2xl border border-black/5 bg-white p-4 sm:p-6";

/** Sessions left and the end date, read now, with the renewal button when allowed. */
function PlanBox({ plan }: { plan: ParentPlan }) {
  return (
    <section className={`${PANEL} space-y-3`}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        המסלול
      </h2>
      <ul className="space-y-1 text-sm">
        {planBoxLines(plan).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {plan.renewUrl && (
        <a
          href={plan.renewUrl}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand-lime px-5 text-sm font-bold text-ink transition-colors hover:bg-brand-lime-hover"
        >
          לחידוש המסלול
        </a>
      )}
    </section>
  );
}

/**
 * The parent's page: the week's text with the first name in it, the Goals,
 * the measurement when there was one, the chosen drills and the plan box.
 * Every number outside the text comes from code, never from the model.
 */
export function ReportBody({ view }: { view: ParentView }) {
  const hasExtras = view.goals.length > 0 || view.body !== null || view.drills.length > 0;
  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">הדוח השבועי של {view.firstName}</h1>
        <p className="text-sm text-black/60">{reportWeekLabel(view.weekStart)}</p>
      </header>

      <section className={PANEL}>
        <p className="whitespace-pre-line text-[15px] leading-7">{view.parentText}</p>
      </section>

      {hasExtras && (
        <section className={`${PANEL} space-y-6`}>
          <GoalProgressList goals={view.goals} title="היעדים" />
          {view.body && <BodyBlock body={view.body} />}
          <DrillList drills={view.drills} />
        </section>
      )}

      {view.plan && <PlanBox plan={view.plan} />}
    </article>
  );
}
