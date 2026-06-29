import { cn } from "@/lib/utils";
import type { AgeGroup, BookAgeRow } from "@/features/development-book/lib/types";

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  "U10-12": "U10-12",
  "U13-14": "U13-14",
  "U15-16": "U15-16",
  "U17+": "U17+",
};

const AGE_GROUP_COLORS: Record<AgeGroup, string> = {
  "U10-12": "bg-sky-400 text-black",
  "U13-14": "bg-primary text-primary-foreground",
  "U15-16": "bg-yellow-400 text-black",
  "U17+": "bg-purple-400 text-black",
};

interface AgeTableProps {
  rows: BookAgeRow[];
  traineeAgeGroup: AgeGroup | null;
  ageMetricLabel: string | null;
}

export function AgeTable({ rows, traineeAgeGroup, ageMetricLabel }: AgeTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        אין נתוני גיל לפרמטר זה
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary/8 text-primary text-xs">
            <th className="px-3 py-2 text-start font-bold tracking-wide">גיל</th>
            <th className="px-3 py-2 text-start font-bold tracking-wide">
              {ageMetricLabel ?? "מה נדרש"}
            </th>
            <th className="px-3 py-2 text-start font-bold tracking-wide">ערך / מדד</th>
            <th className="px-3 py-2 text-start font-bold tracking-wide">התאוששות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isHighlighted = row.ageGroup === traineeAgeGroup;
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-border transition-colors",
                  isHighlighted
                    ? "bg-primary/10 font-semibold"
                    : "hover:bg-muted/40"
                )}
                aria-current={isHighlighted ? "true" : undefined}
              >
                <td className="px-3 py-2 align-top">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold",
                      AGE_GROUP_COLORS[row.ageGroup]
                    )}
                  >
                    {AGE_GROUP_LABELS[row.ageGroup]}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground leading-relaxed">
                  {row.whatHe ?? "—"}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground leading-relaxed">
                  {row.metricValueHe ?? "—"}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground leading-relaxed">
                  {row.recoveryHe ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
