"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayerAssessment } from "@/types/assessment";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { DateRangeFilter } from "./DateRangeFilter";

const RatingTrendChart = dynamic(
  () => import("./RatingTrendChart").then((m) => m.RatingTrendChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    ),
  }
);

const PhysicalMetricChart = dynamic(
  () => import("./PhysicalMetricChart").then((m) => m.PhysicalMetricChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    ),
  }
);
import { useDateRangeFilter } from "../hooks/useDateRangeFilter";
import {
  transformToPhysicalChartData,
  transformToRatingChartData,
} from "../lib/transforms";
import { METRIC_CATEGORIES } from "../lib/config/metric-definitions";
import type { MetricCategory } from "../types";

interface AssessmentProgressChartsProps {
  assessments: readonly PlayerAssessment[];
  groupStats?: GroupStats | null;
}

export function AssessmentProgressCharts({
  assessments,
  groupStats = null,
}: AssessmentProgressChartsProps) {
  const { preset, setPreset, filter } = useDateRangeFilter("6m");
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory>("sprint");

  // Filter assessments by date range
  const filteredAssessments = useMemo(() => {
    return filter(assessments.map((a) => ({ ...a, date: a.assessment_date })));
  }, [assessments, filter]);

  // Transform data for charts
  const ratingChartData = useMemo(() => {
    return transformToRatingChartData(filteredAssessments, groupStats);
  }, [filteredAssessments, groupStats]);

  // Get physical metrics for the selected category
  const physicalChartDataList = useMemo(() => {
    const categoryMetrics = METRIC_CATEGORIES[selectedCategory].metrics;
    return categoryMetrics.map((metric) =>
      transformToPhysicalChartData(filteredAssessments, metric)
    );
  }, [filteredAssessments, selectedCategory]);

  if (assessments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>אין מבדקים עדיין</p>
        <p className="text-sm mt-2">המאמן שלך יוסיף מבדקים בקרוב</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <DateRangeFilter selected={preset} onChange={setPreset} />
      </div>

      {/* Rating Trend Chart */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">מגמת דירוג הכרטיס</h3>
        <RatingTrendChart data={ratingChartData} />
      </div>

      {/* Physical Metrics by Category */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">מבדקים פיזיים</h3>
        <Tabs
          value={selectedCategory}
          onValueChange={(v) => setSelectedCategory(v as MetricCategory)}
          dir="rtl"
        >
          <TabsList className="mb-4 w-full flex-wrap h-auto gap-1">
            {Object.entries(METRIC_CATEGORIES).map(([key, category]) => (
              <TabsTrigger key={key} value={key} className="flex-1 min-w-0">
                {category.labelHe}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {physicalChartDataList.map((chartData) => (
              <PhysicalMetricChart key={chartData.metric} data={chartData} />
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
