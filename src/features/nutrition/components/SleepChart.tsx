"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Moon } from "lucide-react";
import type { SleepDataPoint } from "../types";
import { SLEEP_COLORS, SLEEP_LEGEND_LABELS } from "../lib/config";

interface SleepChartProps {
  data: SleepDataPoint[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    payload: { monthDisplay: string; total: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0].payload;
  return (
    <div
      className="bg-background border rounded-lg shadow-lg p-3 text-sm"
      dir="rtl"
    >
      <p className="font-medium mb-2">{dataPoint.monthDisplay}</p>
      <div className="space-y-1">
        {[...payload].reverse().map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color }}
              />
              {SLEEP_LEGEND_LABELS[entry.dataKey] ?? entry.dataKey}
            </span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
        <div className="border-t pt-1 mt-1 flex justify-between">
          <span>סה&quot;כ</span>
          <span className="font-medium">{dataPoint.total}</span>
        </div>
      </div>
    </div>
  );
}

export function SleepChart({ data }: SleepChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            מגמת איכות שינה
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          אין נתוני שינה זמינים עדיין. מלאו שאלוני טרום אימון כדי לראות נתונים כאן.
        </CardContent>
      </Card>
    );
  }

  const totals = data.reduce(
    (acc, point) => ({
      good: acc.good + point.good,
      moderate: acc.moderate + point.moderate,
      total: acc.total + point.total,
    }),
    { good: 0, moderate: 0, total: 0 }
  );

  const qualityPercentage =
    totals.total > 0
      ? Math.round(((totals.good + totals.moderate) / totals.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              מגמת איכות שינה
            </CardTitle>
            <CardDescription>מבוסס על שאלוני טרום אימון</CardDescription>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{qualityPercentage}%</div>
            <div className="text-xs text-muted-foreground">איכות כוללת</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: 300 }} dir="ltr" role="img" aria-label="גרף מגמת איכות שינה">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="monthDisplay"
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
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value: string) =>
                  SLEEP_LEGEND_LABELS[value] ?? value
                }
              />
              <Bar
                dataKey="poor"
                stackId="a"
                fill={SLEEP_COLORS.poor}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="moderate"
                stackId="a"
                fill={SLEEP_COLORS.moderate}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="good"
                stackId="a"
                fill={SLEEP_COLORS.good}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
