"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { PhysicalMetricChartData, ChartDataPoint } from "../types";
import { calculateTrend, getTrendColor } from "../lib/utils";

interface PhysicalMetricChartProps {
  data: PhysicalMetricChartData;
  height?: number;
}

function PhysicalMetricTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: ChartDataPoint }[]; unit: string }) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-2 text-sm" dir="rtl">
        <p className="font-medium">{dataPoint.dateDisplay}</p>
        <p className="text-muted-foreground">
          {dataPoint.value} {unit}
        </p>
      </div>
    );
  }
  return null;
}

export function PhysicalMetricChart({ data, height = 200 }: PhysicalMetricChartProps) {
  if (data.data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{data.labelHe}</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          אין נתונים
        </CardContent>
      </Card>
    );
  }

  const trend = calculateTrend(data.data, data.lowerIsBetter);
  const latestValue = data.data[data.data.length - 1].value;
  const trendColor = getTrendColor(trend.isImproving);

  const TrendIcon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
      ? TrendingDown
      : Minus;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{data.labelHe}</CardTitle>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <span className="text-sm font-medium">
              {latestValue} {data.unit}
            </span>
          </div>
        </div>
        {data.data.length > 1 && (
          <CardDescription className="text-xs">
            {trend.percentChange > 0 ? "+" : ""}
            {trend.percentChange.toFixed(1)}% מהמבדק הראשון
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ width: "100%", height }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dateDisplay"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                className="fill-muted-foreground"
                domain={["auto", "auto"]}
              />
              <Tooltip content={<PhysicalMetricTooltip unit={data.unit} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
