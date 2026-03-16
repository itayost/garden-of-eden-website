"use client";

import { useMemo } from "react";
import type { PlayerAssessment } from "@/types/assessment";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { MiniRatingChart, transformToRatingChartData } from "@/features/progress-charts";

interface MiniRatingChartWrapperProps {
  assessments: PlayerAssessment[];
  groupStats: GroupStats | null;
}

export function MiniRatingChartWrapper({
  assessments,
  groupStats,
}: MiniRatingChartWrapperProps) {
  const chartData = useMemo(() => {
    return transformToRatingChartData(assessments, groupStats);
  }, [assessments, groupStats]);

  return <MiniRatingChart data={chartData} />;
}
