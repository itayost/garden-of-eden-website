"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { DistributionBin, RankingCategory } from "../types";
import { RANKING_CATEGORIES } from "../lib/config/categories";

interface DistributionChartProps {
  distribution: DistributionBin[];
  category: RankingCategory;
  height?: number;
}

// Custom tooltip component - defined outside to avoid recreation during render
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DistributionBin }[];
}) {
  if (active && payload && payload.length) {
    const bin = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-2 text-sm" dir="rtl">
        <p className="font-medium">{bin.label}</p>
        <p className="text-muted-foreground">{bin.count} שחקנים</p>
      </div>
    );
  }
  return null;
}

export function DistributionChart({
  distribution,
  category,
  height = 200,
}: DistributionChartProps) {
  const config = RANKING_CATEGORIES[category];

  if (distribution.length === 0) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            התפלגות תוצאות - {config.labelHe}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 py-8 text-center text-muted-foreground">
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
          התפלגות תוצאות - {config.labelHe}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          כמה שחקנים בכל טווח תוצאות
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div style={{ width: "100%", height }} dir="ltr">
          <ResponsiveContainer>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={30}
                className="fill-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
