"use client";

import type { PlayerAssessment } from "@/types/assessment";
import { AssessmentProgressCharts, type RatingDataPoint } from "@/features/progress-charts";

interface AssessmentChartsWrapperProps {
  assessments: PlayerAssessment[];
  ratingHistory: RatingDataPoint[];
}

export function AssessmentChartsWrapper({
  assessments,
  ratingHistory,
}: AssessmentChartsWrapperProps) {
  return (
    <AssessmentProgressCharts
      assessments={assessments}
      ratingHistory={ratingHistory}
    />
  );
}
