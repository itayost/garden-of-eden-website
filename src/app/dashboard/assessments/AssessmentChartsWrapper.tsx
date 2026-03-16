"use client";

import type { PlayerAssessment } from "@/types/assessment";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { AssessmentProgressCharts } from "@/features/progress-charts";

interface AssessmentChartsWrapperProps {
  assessments: PlayerAssessment[];
  groupStats: GroupStats | null;
}

export function AssessmentChartsWrapper({
  assessments,
  groupStats,
}: AssessmentChartsWrapperProps) {
  return (
    <AssessmentProgressCharts
      assessments={assessments}
      groupStats={groupStats}
    />
  );
}
