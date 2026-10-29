"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { SURVEY_LIST_FILTERS, type SurveyListFilter } from "../../lib/state";
import { SegmentedRadioGroup } from "./SegmentedRadioGroup";

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
    <SegmentedRadioGroup
      label="סינון לפי מצב"
      options={SURVEY_LIST_FILTERS}
      value={state}
      onChange={(filter) => void setState(filter)}
      renderOption={(filter) => FILTER_LABELS[filter]}
      className="inline-flex"
    />
  );
}
