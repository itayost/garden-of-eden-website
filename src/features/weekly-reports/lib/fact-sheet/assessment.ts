/**
 * An Assessment dated in the Report week, as progress facts. Pure.
 *
 * Improvements are named with their change; regressions are only counted: the
 * report is about progress, and staff see the numbers in the Assessment
 * screens. The Assessment's written notes are never read.
 */

import { compareAssessments } from "@/features/assessment-comparison/lib/comparison-utils";
import { calculateCardRatings } from "@/lib/assessment-to-rating";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import type { AssessmentFacts, TraineeWeekInput } from "./types";

export function assessmentFacts(input: TraineeWeekInput["assessment"]): AssessmentFacts | null {
  const { inWeek, previous, groupStats } = input;
  if (inWeek === null) return null;
  const rating = groupStats ? calculateCardRatings(inWeek, groupStats).overall_rating : null;
  if (previous === null) {
    return { date: inWeek.assessment_date, first: true, improvements: [], unchanged: 0, regressions: 0, rating };
  }
  const comparison = compareAssessments(previous, inWeek);
  const improvements = Object.entries(comparison.deltas)
    .filter(([, delta]) => delta.isImprovement === true)
    .map(([key, delta]) => ({ label: ASSESSMENT_LABELS_HE[key] ?? key, change: delta.formatted }));
  return {
    date: inWeek.assessment_date,
    first: false,
    improvements,
    unchanged: comparison.summary.unchanged,
    regressions: comparison.summary.regressions,
    rating,
  };
}
