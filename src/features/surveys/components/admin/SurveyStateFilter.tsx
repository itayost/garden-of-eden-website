"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { SURVEY_LIST_FILTERS, type SurveyListFilter } from "../../lib/state";

const FILTER_LABELS: Record<SurveyListFilter, string> = {
  all: "הכל",
  open: "פתוחים",
  draft: "טיוטות",
  ended: "הסתיימו",
};

/**
 * The list's state filter, kept in `?state=`. shallow: false makes nuqs
 * re-render the server page, which filters the rows.
 */
export function SurveyStateFilter() {
  const [state, setState] = useQueryState(
    "state",
    parseAsStringLiteral(SURVEY_LIST_FILTERS).withDefault("all").withOptions({ shallow: false }),
  );

  return (
    <div role="radiogroup" aria-label="סינון לפי מצב" className="inline-flex gap-0.5 rounded-lg bg-muted p-1">
      {SURVEY_LIST_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          role="radio"
          aria-checked={state === filter}
          onClick={() => setState(filter)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            state === filter && "bg-card text-foreground shadow-sm",
          )}
        >
          {FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  );
}
