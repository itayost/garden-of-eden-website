"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const RadarStatsChart = dynamic(
  () => import("@/features/progress-charts/components/RadarStatsChart").then((m) => m.RadarStatsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
);

interface Props {
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
}

export function RadarStatsChartWrapper({ stats }: Props) {
  return <RadarStatsChart stats={stats} />;
}
