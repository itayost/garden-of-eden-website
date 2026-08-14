import { cn } from "@/lib/utils";
import { MEASURE_DEFS, type MeasureFlagColumn } from "@/lib/validations/measures";

/**
 * The measures a machine records, as compact chips.
 *
 * Shared by the equipment catalog and the exercise library so a trainer reads
 * the same vocabulary in both places. Order and labels come from MEASURE_DEFS.
 */

export type MeasureFlags = Record<MeasureFlagColumn, boolean>;

interface MeasureBadgesProps {
  measures: MeasureFlags;
  className?: string;
}

export function MeasureBadges({ measures, className }: MeasureBadgesProps) {
  const active = MEASURE_DEFS.filter((measure) => measures[measure.column]);
  if (active.length === 0) return null;

  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {active.map((measure) => (
        <span
          key={measure.column}
          className="rounded bg-forest px-1.5 py-0.5 text-[10px] font-bold text-cream"
        >
          {measure.label}
        </span>
      ))}
    </span>
  );
}
