import type { SurveyRecord, SurveyState } from "./types";

/**
 * Days are Israel calendar dates in YYYY-MM-DD form, so plain string
 * comparison orders them correctly.
 */
export function surveyState(
  survey: Pick<SurveyRecord, "publishedAt" | "closedAt" | "opensOn" | "closesOn">,
  today: string,
): SurveyState {
  if (survey.publishedAt === null) return "draft";
  if (survey.closedAt !== null) return "ended";
  if (survey.opensOn > today) return "scheduled";
  if (survey.closesOn !== null && survey.closesOn < today) return "ended";
  return "open";
}

/** A survey published after its open date opens today, not in the past. */
export function publishedOpensOn(opensOn: string, today: string): string {
  return opensOn < today ? today : opensOn;
}

export type SurveyListFilter = "all" | "open" | "draft" | "ended";

export function matchesListFilter(state: SurveyState, filter: SurveyListFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return state === "open" || state === "scheduled";
    case "draft":
      return state === "draft";
    case "ended":
      return state === "ended";
  }
}

export const SURVEY_STATE_HE: Record<SurveyState, string> = {
  draft: "טיוטה",
  scheduled: "מתוכנן",
  open: "פתוח",
  ended: "הסתיים",
};
