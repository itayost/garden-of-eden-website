"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgeTable } from "./AgeTable";
import type { AgeGroup, BookAgeRow } from "@/features/development-book/lib/types";

interface AgePanelProps {
  ageRows: BookAgeRow[];
  traineeAgeGroup: AgeGroup | null;
  ageMetricLabel: string | null;
}

export function AgePanel({ ageRows, traineeAgeGroup, ageMetricLabel }: AgePanelProps) {
  const [showAll, setShowAll] = useState(false);

  if (ageRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        אין נתוני גיל לפרמטר זה
      </p>
    );
  }

  // The trainee's own row comes first; the rest are shown when expanded
  const traineeRow = ageRows.find((r) => r.ageGroup === traineeAgeGroup);
  const otherRows = ageRows.filter((r) => r.ageGroup !== traineeAgeGroup);

  // When no trainee age group is known, show all rows in their original order
  const primaryRows = traineeRow ? [traineeRow] : ageRows;
  const secondaryRows = traineeRow ? otherRows : [];

  // Build the list to display according to toggle state
  const displayedRows = showAll ? [...primaryRows, ...secondaryRows] : primaryRows;

  return (
    <div className="space-y-3">
      <AgeTable
        rows={displayedRows}
        traineeAgeGroup={traineeAgeGroup}
        ageMetricLabel={ageMetricLabel}
      />

      {secondaryRows.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground",
            "hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              showAll && "rotate-180"
            )}
          />
          {showAll
            ? "הסתר גילאים נוספים"
            : `הצג כל הגילאים (${secondaryRows.length} נוספים)`}
        </button>
      )}
    </div>
  );
}
