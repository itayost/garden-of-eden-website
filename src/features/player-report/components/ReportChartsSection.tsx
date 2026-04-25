"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportData } from "../types";
import type { RatingDataPoint } from "@/features/progress-charts";
import type { PlayerAssessment } from "@/types/assessment";

const RadarStatsChart = dynamic(
  () =>
    import("@/features/progress-charts/components/RadarStatsChart").then(
      (m) => m.RadarStatsChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> },
);

const AssessmentProgressCharts = dynamic(
  () =>
    import(
      "@/features/progress-charts/components/AssessmentProgressCharts"
    ).then((m) => m.AssessmentProgressCharts),
  { ssr: false, loading: () => <Skeleton className="h-[400px]" /> },
);

interface ReportChartsSectionProps {
  stats: ReportData["stats"];
  assessments: readonly PlayerAssessment[];
  ratingHistory: readonly RatingDataPoint[];
}

export function ReportChartsSection({
  stats,
  assessments,
  ratingHistory,
}: ReportChartsSectionProps) {
  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>דירוג שחקן</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <RadarStatsChart stats={stats} height={350} />
            </div>
          </CardContent>
        </Card>
      )}

      {assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>מגמות התפתחות</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <AssessmentProgressCharts assessments={assessments} ratingHistory={ratingHistory} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
