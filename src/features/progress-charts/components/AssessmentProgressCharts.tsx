"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlayerAssessment } from "@/types/assessment";
import { calculateGroupStats, getLatestAssessmentsPerUser } from "@/lib/assessment-to-rating";
import { DateRangeFilter } from "./DateRangeFilter";
import { RatingTrendChart } from "./RatingTrendChart";
import { PhysicalMetricChart } from "./PhysicalMetricChart";
import { PercentileCard } from "./PercentileCard";
import { useDateRangeFilter } from "../hooks/useDateRangeFilter";
import {
  transformToPhysicalChartData,
  transformToRatingChartData,
  calculatePercentileRankings,
} from "../lib/transforms";
import { METRIC_CATEGORIES } from "../lib/config/metric-definitions";
import type { MetricCategory } from "../types";

interface AssessmentProgressChartsProps {
  assessments: PlayerAssessment[];
  allAssessmentsInGroup?: PlayerAssessment[]; // For percentile calculations
}

export function AssessmentProgressCharts({
  assessments,
  allAssessmentsInGroup = [],
}: AssessmentProgressChartsProps) {
  const { preset, setPreset, filter } = useDateRangeFilter("6m");
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory>("sprint");

  // Calculate group stats for relative ratings (using only latest assessment per user)
  const groupStats = useMemo(() => {
    if (allAssessmentsInGroup.length > 1) {
      const latestAssessments = getLatestAssessmentsPerUser(allAssessmentsInGroup);
      return calculateGroupStats(latestAssessments);
    }
    return null;
  }, [allAssessmentsInGroup]);

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

  // Calculate percentiles if group data is available
  const percentileRankings = useMemo(() => {
    if (allAssessmentsInGroup.length === 0 || filteredAssessments.length === 0) {
      return [];
    }
    const latestAssessment = filteredAssessments[filteredAssessments.length - 1];
    return calculatePercentileRankings(latestAssessment, allAssessmentsInGroup);
  }, [filteredAssessments, allAssessmentsInGroup]);

  // Top percentile rankings (best 3, highest percentile first)
  // Note: percentileRankings already filters out null values in calculatePercentileRankings
  const topPercentiles = useMemo(() => {
    return [...percentileRankings]
      .sort((a, b) => b.percentile - a.percentile)
      .slice(0, 3);
  }, [percentileRankings]);

  if (assessments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>אין מבדקים עדיין</p>
        <p className="text-sm mt-2">המאמן שלך יוסיף מבדקים בקרוב</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <DateRangeFilter selected={preset} onChange={setPreset} />
      </div>

      {/* Top Percentiles (if available) */}
      {topPercentiles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">הדירוגים הטובים שלך</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {topPercentiles.map((ranking) => (
              <PercentileCard key={ranking.metric} ranking={ranking} />
            ))}
          </div>
        </div>
      )}

      {/* Rating Trend Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-3">מגמת דירוג הכרטיס</h3>
        <RatingTrendChart data={ratingChartData} />
      </div>

      {/* Physical Metrics by Category */}
      <div>
        <h3 className="text-lg font-semibold mb-3">מבדקים פיזיים</h3>
        <Tabs
          value={selectedCategory}
          onValueChange={(v) => setSelectedCategory(v as MetricCategory)}
          dir="rtl"
        >
          <TabsList className="mb-4">
            {Object.entries(METRIC_CATEGORIES).map(([key, category]) => (
              <TabsTrigger key={key} value={key}>
                {category.labelHe}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(METRIC_CATEGORIES).map((categoryKey) => (
            <TabsContent key={categoryKey} value={categoryKey}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryKey === selectedCategory &&
                  physicalChartDataList.map((chartData) => (
                    <PhysicalMetricChart key={chartData.metric} data={chartData} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
