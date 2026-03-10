"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { RATING_LABELS_HE } from "../lib/config/metric-definitions";

interface RadarStatsChartProps {
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  height?: number;
}

const STAT_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;

export function RadarStatsChart({ stats, height = 300 }: RadarStatsChartProps) {
  const data = STAT_KEYS.map((key) => ({
    stat: RATING_LABELS_HE[key],
    value: stats[key],
    fullMark: 99,
  }));

  return (
    <div dir="ltr" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 99]}
            tick={{ fontSize: 10 }}
          />
          <Radar
            name="Stats"
            dataKey="value"
            stroke="hsl(142, 76%, 36%)"
            fill="hsl(142, 76%, 36%)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
