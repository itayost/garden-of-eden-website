"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PercentileRanking } from "../types";
import { getPercentileColor, getPercentileBgColor } from "../lib/utils";

interface PercentileCardProps {
  ranking: PercentileRanking;
  ageGroupLabel?: string;
}

export function PercentileCard({ ranking, ageGroupLabel }: PercentileCardProps) {
  const color = getPercentileColor(ranking.percentile);
  const bgColor = getPercentileBgColor(ranking.percentile);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {ranking.metricLabelHe}
            </p>
            <p className="text-xl font-bold">
              {ranking.value} <span className="text-xs font-normal">{ranking.unit}</span>
            </p>
          </div>
          <div className={cn("p-1.5 rounded-full", bgColor)}>
            <Trophy className={cn("h-4 w-4", color)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn(bgColor, color, "border-0")}>
            {ranking.percentileDisplay}
          </Badge>
          {ageGroupLabel && (
            <span className="text-xs text-muted-foreground">
              ב{ageGroupLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
