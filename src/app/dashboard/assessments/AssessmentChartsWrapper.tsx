"use client";

import type { PlayerAssessment } from "@/types/assessment";
import { AssessmentProgressCharts } from "@/features/progress-charts";

interface AssessmentChartsWrapperProps {
  assessments: PlayerAssessment[];
  allAssessmentsInGroup?: PlayerAssessment[];
}

export function AssessmentChartsWrapper({
  assessments,
  allAssessmentsInGroup = [],
}: AssessmentChartsWrapperProps) {
  return (
    <AssessmentProgressCharts
      assessments={assessments}
      allAssessmentsInGroup={allAssessmentsInGroup}
    />
  );
}
