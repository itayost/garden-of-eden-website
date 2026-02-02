"use client";

import { useMemo } from "react";
import type { PlayerAssessment } from "@/types/assessment";
import { calculateGroupStats, getLatestAssessmentsPerUser, type GroupStats } from "@/lib/assessment-to-rating";
import { MiniRatingChart, transformToRatingChartData } from "@/features/progress-charts";

interface MiniRatingChartWrapperProps {
  assessments: PlayerAssessment[];
  allAssessmentsInGroup?: PlayerAssessment[];
}

export function MiniRatingChartWrapper({
  assessments,
  allAssessmentsInGroup = [],
}: MiniRatingChartWrapperProps) {
  // Calculate group stats for relative ratings (using only latest assessment per user)
  const groupStats = useMemo<GroupStats | null>(() => {
    if (allAssessmentsInGroup.length > 1) {
      const latestAssessments = getLatestAssessmentsPerUser(allAssessmentsInGroup);
      return calculateGroupStats(latestAssessments);
    }
    return null;
  }, [allAssessmentsInGroup]);

  // Transform to chart data
  const chartData = useMemo(() => {
    return transformToRatingChartData(assessments, groupStats);
  }, [assessments, groupStats]);

  return <MiniRatingChart data={chartData} />;
}
