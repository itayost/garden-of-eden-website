import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BookDrill, DrillProgressMap } from "@/features/development-book/lib/types";
import { DrillDoneToggle } from "@/features/development-book/components/trainee/DrillDoneToggle";

interface DrillRowProps {
  drill: BookDrill;
  done: boolean;
}

function DrillRow({ drill, done }: DrillRowProps) {
  return (
    <li
      className={cn(
        "relative rounded-xl border border-border bg-card/50 p-4",
        "border-s-2 border-s-primary",
        done && "opacity-75"
      )}
    >
      {/* Full-card navigation link sits behind interactive elements */}
      <Link
        href={`/dashboard/book/drills/${drill.id}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        aria-label={drill.nameHe ?? drill.nameEn ?? "תרגיל"}
        tabIndex={-1}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Drill name — readable, pointer-events delegated to overlay link */}
          <p className="font-bold text-sm text-foreground">
            {drill.nameHe ?? drill.nameEn ?? "תרגיל"}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {drill.muscles.length > 0
              ? drill.muscles.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary"
                  >
                    {m.emoji ? `${m.emoji} ${m.nameHe}` : m.nameHe}
                  </span>
                ))
              : drill.muscleHe && (
                  <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                    {drill.muscleHe}
                  </span>
                )}
            {drill.setsHe && (
              <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-yellow-400/10 text-yellow-600 dark:text-yellow-400">
                {drill.setsHe}
              </span>
            )}
          </div>

          {/* How */}
          {drill.howHe && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {drill.howHe}
            </p>
          )}

          {/* Why */}
          {drill.whyHe && (
            <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-relaxed border-t border-border pt-1.5">
              <strong className="font-semibold text-muted-foreground">למה: </strong>
              {drill.whyHe}
            </p>
          )}
        </div>

        {/* Toggle sits above the overlay link via relative + z-10 */}
        <div className="relative z-10 shrink-0">
          <DrillDoneToggle drillId={drill.id} initialDone={done} />
        </div>
      </div>
    </li>
  );
}

interface DrillsPanelProps {
  drills: BookDrill[];
  doneMap: DrillProgressMap;
}

export function DrillsPanel({ drills, doneMap }: DrillsPanelProps) {
  if (drills.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        אין תרגילים לפרמטר זה כרגע
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {drills.map((drill) => (
        <DrillRow key={drill.id} drill={drill} done={!!doneMap[drill.id]} />
      ))}
    </ul>
  );
}
