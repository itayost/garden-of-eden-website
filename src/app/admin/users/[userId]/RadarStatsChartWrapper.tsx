"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const RadarStatsChart = dynamic(
  () => import("@/features/progress-charts/components/RadarStatsChart").then((m) => m.RadarStatsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
);

interface Props {
  stats: {
    pace: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
  };
}

export function RadarStatsChartWrapper({ stats }: Props) {
  return <RadarStatsChart stats={stats} />;
}
