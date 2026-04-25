"use client";

import { MiniRatingChart, type RatingDataPoint } from "@/features/progress-charts";

interface MiniRatingChartWrapperProps {
  data: RatingDataPoint[];
}

export function MiniRatingChartWrapper({ data }: MiniRatingChartWrapperProps) {
  return <MiniRatingChart data={data} />;
}
