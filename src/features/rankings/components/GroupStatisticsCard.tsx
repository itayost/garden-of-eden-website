"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ASSESSMENT_LABELS_HE, ASSESSMENT_UNITS } from "@/types/assessment";
import type { GroupStatistics, RankingCategory } from "../types";
import { RANKING_CATEGORIES } from "../lib/config/categories";

interface GroupStatisticsCardProps {
  statistics: GroupStatistics | null;
  category: RankingCategory;
}

interface StatItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

function StatItem({ label, value, icon }: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="font-medium font-mono">{value}</span>
    </div>
  );
}

export function GroupStatisticsCard({ statistics, category }: GroupStatisticsCardProps) {
  const config = RANKING_CATEGORIES[category];
  // Unit follows the specific metric being ranked, not the broad category
  // (e.g. power ranks kick_power_right_foot which is "יח׳ כוח", not "%").
  const unit = ASSESSMENT_UNITS[config.primaryMetric] ?? "ס״מ";
  const metricLabel = ASSESSMENT_LABELS_HE[config.primaryMetric] ?? config.labelHe;

  // For "higher is better" metrics (jump, flexibility, power, agility) the best
  // value is the max and the worst is the min. Only sprints invert this.
  const bestValue = config.lowerIsBetter ? statistics?.min : statistics?.max;
  const worstValue = config.lowerIsBetter ? statistics?.max : statistics?.min;

  if (!statistics) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            סטטיסטיקות קבוצה - {config.labelHe}
          </CardTitle>
          <p className="text-xs text-muted-foreground ps-7">{metricLabel}</p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 py-6 sm:py-8 text-center text-muted-foreground">
          אין נתונים להצגה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          סטטיסטיקות קבוצה - {config.labelHe}
        </CardTitle>
        <p className="text-xs text-muted-foreground ps-7">{metricLabel}</p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-1">
        <StatItem
          label="מספר משתתפים"
          value={statistics.count.toString()}
        />
        <StatItem
          label="ממוצע"
          value={`${statistics.average.toFixed(2)} ${unit}`}
          icon={<Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        />
        <StatItem
          label="חציון"
          value={`${statistics.median.toFixed(2)} ${unit}`}
        />
        <StatItem
          label={config.lowerIsBetter ? "הכי מהיר" : "הכי טוב"}
          value={`${(bestValue ?? 0).toFixed(2)} ${unit}`}
          icon={<TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />}
        />
        <StatItem
          label={config.lowerIsBetter ? "הכי איטי" : "הכי נמוך"}
          value={`${(worstValue ?? 0).toFixed(2)} ${unit}`}
          icon={<TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />}
        />
      </CardContent>
    </Card>
  );
}
