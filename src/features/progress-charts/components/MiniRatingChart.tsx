"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { RatingDataPoint } from "../types";

interface MiniRatingChartProps {
  data: RatingDataPoint[];
  height?: number;
}

export function MiniRatingChart({ data, height = 80 }: MiniRatingChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">מגמת דירוג</CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-center text-muted-foreground text-xs">
          אין נתונים
        </CardContent>
      </Card>
    );
  }

  const latestRating = data[data.length - 1].overall_rating;
  const firstRating = data[0].overall_rating;
  const change = latestRating - firstRating;

  let TrendIcon = Minus;
  let trendColor = "text-muted-foreground";

  if (change > 0) {
    TrendIcon = TrendingUp;
    trendColor = "text-green-500";
  } else if (change < 0) {
    TrendIcon = TrendingDown;
    trendColor = "text-red-500";
  }

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: RatingDataPoint }>
  }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-2 text-xs" dir="rtl">
          <p className="font-medium">{dataPoint.dateDisplay}</p>
          <p className="text-muted-foreground">דירוג: {dataPoint.overall_rating}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">מגמת דירוג</CardTitle>
          <div className="flex items-center gap-1">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <span className="text-lg font-bold">{latestRating}</span>
          </div>
        </div>
        {data.length > 1 && (
          <p className={`text-xs ${trendColor}`}>
            {change > 0 ? "+" : ""}{change} נקודות
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <div style={{ width: "100%", height }} dir="ltr">
          <ResponsiveContainer>
            <LineChart data={data}>
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="overall_rating"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
