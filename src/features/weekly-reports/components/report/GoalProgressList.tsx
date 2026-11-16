import { BrandProgress } from "@/components/ui/brand-progress";
import type { GoalFact } from "../../lib/fact-sheet/types";
import { goalLine } from "../../lib/report-view";

interface GoalProgressListProps {
  goals: readonly GoalFact[];
  title: string;
}

/**
 * The open Goals of the report's week, each with its progress bar, as the
 * stored Fact sheet holds them. Shared by the parent page and the player's
 * card; renders nothing without a Goal.
 */
export function GoalProgressList({ goals, title }: GoalProgressListProps) {
  if (goals.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="space-y-3">
        {goals.map((goal, index) => (
          <li key={`${goal.metric}-${index}`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{goal.metric}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{goal.progressPercent}%</span>
            </div>
            <BrandProgress value={goal.progressPercent} max={100} size="sm" label={`ההתקדמות ביעד: ${goal.metric}`} />
            <p className="text-xs text-muted-foreground">{goalLine(goal)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
