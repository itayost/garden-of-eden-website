"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  const unit = config.lowerIsBetter ? "שניות" : "ס״מ";

  if (!statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            סטטיסטיקות קבוצה - {config.labelHe}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          אין נתונים להצגה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          סטטיסטיקות קבוצה - {config.labelHe}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <StatItem
          label="מספר משתתפים"
          value={statistics.count.toString()}
        />
        <StatItem
          label="ממוצע"
          value={`${statistics.average.toFixed(2)} ${unit}`}
          icon={<Minus className="h-4 w-4" />}
        />
        <StatItem
          label="חציון"
          value={`${statistics.median.toFixed(2)} ${unit}`}
        />
        <StatItem
          label={config.lowerIsBetter ? "הכי מהיר" : "הכי טוב"}
          value={`${statistics.min.toFixed(2)} ${unit}`}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
        />
        <StatItem
          label={config.lowerIsBetter ? "הכי איטי" : "הכי נמוך"}
          value={`${statistics.max.toFixed(2)} ${unit}`}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
        />
      </CardContent>
    </Card>
  );
}
