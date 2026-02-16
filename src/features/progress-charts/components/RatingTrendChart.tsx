"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RatingDataPoint } from "../types";
import { RATING_COLORS, RATING_LABELS_HE } from "../lib/config/metric-definitions";

interface RatingTrendChartProps {
  data: RatingDataPoint[];
  height?: number;
}

type RatingStat = "overall_rating" | "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical";

const ALL_STATS: RatingStat[] = ["overall_rating", "pace", "shooting", "passing", "dribbling", "defending", "physical"];

function RatingTrendTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; payload: RatingDataPoint }>
}) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm" dir="rtl">
        <p className="font-medium mb-2">{dataPoint.dateDisplay}</p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {RATING_LABELS_HE[entry.dataKey]}
              </span>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function RatingTrendChart({ data, height = 300 }: RatingTrendChartProps) {
  const [visibleStats, setVisibleStats] = useState<RatingStat[]>(["overall_rating"]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">מגמת דירוגים</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          אין נתוני דירוג
        </CardContent>
      </Card>
    );
  }

  const latestRating = data[data.length - 1].overall_rating;
  const firstRating = data[0].overall_rating;
  const ratingChange = latestRating - firstRating;

  const toggleStat = (stat: RatingStat) => {
    setVisibleStats((prev) => {
      if (prev.includes(stat)) {
        // Don't allow removing the last stat
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== stat);
      }
      return [...prev, stat];
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">מגמת דירוגים</CardTitle>
            {data.length > 1 && (
              <CardDescription className="text-xs">
                שינוי בדירוג הכללי: {ratingChange > 0 ? "+" : ""}{ratingChange} נקודות
              </CardDescription>
            )}
          </div>
          <div className="text-2xl font-bold">{latestRating}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Stat toggles */}
        <div className="mb-4 flex flex-wrap gap-1.5" dir="rtl">
          {ALL_STATS.map((stat) => {
            const isActive = visibleStats.includes(stat);
            return (
              <Button
                key={stat}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn(
                  "text-xs h-8 px-3",
                  isActive && "border-2"
                )}
                style={{
                  borderColor: isActive ? RATING_COLORS[stat] : undefined,
                  backgroundColor: isActive ? RATING_COLORS[stat] : undefined,
                }}
                onClick={() => toggleStat(stat)}
              >
                {RATING_LABELS_HE[stat]}
              </Button>
            );
          })}
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                width={30}
                domain={[0, 99]}
                className="fill-muted-foreground"
              />
              <Tooltip content={<RatingTrendTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value: string) => RATING_LABELS_HE[value]}
              />
              {visibleStats.map((stat) => (
                <Line
                  key={stat}
                  type="monotone"
                  dataKey={stat}
                  stroke={RATING_COLORS[stat]}
                  strokeWidth={stat === "overall_rating" ? 3 : 2}
                  dot={{ r: stat === "overall_rating" ? 4 : 3 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
